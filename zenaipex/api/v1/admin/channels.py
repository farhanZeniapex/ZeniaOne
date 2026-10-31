"""
Admin Channels API.
"""
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from twilio.rest import Client
import logging
import time
import re
from html import escape

logger = logging.getLogger(__name__)
from core.config import settings
from services import channel_service
from core.database import col_channels, col_conversations, col_messages, col_subscriptions, col_usage_records, col_scheduled_calls, col_activity_logs
from core.exceptions import NotFoundError
from core.dependencies import require_channel_admin
from bson import ObjectId
from services.voice_channel_mapping import channel_conversation_query, phone_numbers_match

router = APIRouter()
_twilio_history_sync_at: dict[str, float] = {}
_exotel_history_sync_at: dict[str, float] = {}


async def _sync_exotel_history(channel: dict) -> dict:
    """Reconcile the visible Exotel history with provider Call SIDs."""
    import httpx
    from datetime import datetime, timedelta, timezone
    from core.security import decrypt_secret

    config = channel.get("config") or {}
    credentials = channel.get("credentials") or {}
    account_sid = str(config.get("exotel_account_sid") or settings.exotel_account_sid or "").strip()
    api_key = decrypt_secret(credentials.get("api_key_encrypted", "")) or settings.exotel_api_key
    api_token = decrypt_secret(credentials.get("api_token_encrypted", "")) or settings.exotel_api_token
    number = str(channel.get("phone_number") or "").strip()
    if not all((account_sid, api_key, api_token, number)):
        return {"synced": False, "reason": "missing_provider_credentials"}

    ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(ist)
    start = now_ist - timedelta(days=30)
    host = settings.exotel_subdomain or "api.exotel.com"
    url = f"https://{host}/v1/Accounts/{account_sid}/Calls.json"
    params = {
        "DateCreated": f"gte:{start:%Y-%m-%d %H:%M:%S};lte:{now_ist:%Y-%m-%d %H:%M:%S}",
        "PageSize": 100,
    }
    calls: dict[str, dict] = {}
    async with httpx.AsyncClient(timeout=20.0) as client:
        for _ in range(20):
            response = await client.get(url, auth=(api_key, api_token), params=params)
            response.raise_for_status()
            payload = response.json()
            for call in payload.get("Calls") or []:
                if call.get("Sid") and phone_numbers_match(call.get("PhoneNumber"), number):
                    calls[str(call["Sid"])] = call
            metadata = payload.get("Metadata") or {}
            next_uri = metadata.get("NextPageUri")
            if not next_uri:
                break
            url = f"https://{host}{next_uri}" if str(next_uri).startswith("/") else str(next_uri)
            params = None

    if not calls:
        return {"synced": False, "reason": "no_provider_calls"}

    channel_id = str(channel["_id"])
    company_id = str(channel["company_id"])
    sids = list(calls)
    existing = await col_conversations().find({
        "company_id": company_id,
        "call_sid": {"$in": sids},
    }).to_list(length=None)
    existing_by_sid = {str(doc.get("call_sid")): doc for doc in existing}
    start_utc = start.astimezone(timezone.utc)
    archived = 0
    inserted = 0
    updated = 0

    for sid, call in calls.items():
        outbound = str(call.get("Direction") or "").lower().startswith("outbound")
        direction = "outbound" if outbound else "inbound"
        provider_from = str(call.get("From") or "")
        provider_to = str(call.get("To") or number)
        if outbound:
            # Exotel's outbound list can expose the dialled party in From and
            # the ExoPhone in To. The UI must show the actual customer as To.
            customer_phone = provider_from if phone_numbers_match(provider_to, number) else provider_to
            from_phone = number
            to_phone = customer_phone
        else:
            from_phone = provider_from
            to_phone = provider_to
        try:
            started_at = datetime.strptime(str(call.get("DateCreated")), "%Y-%m-%d %H:%M:%S").replace(tzinfo=ist).astimezone(timezone.utc)
        except (TypeError, ValueError):
            started_at = datetime.now(timezone.utc)
        try:
            # Exotel Duration includes ringing/setup time. DialCallDuration is
            # the connected talk time shown in the provider dashboard and must
            # win even when its explicit value is zero.
            raw_duration = call.get("DialCallDuration")
            if raw_duration is None or str(raw_duration).strip() == "":
                raw_duration = call.get("ConversationDuration")
            if raw_duration is None or str(raw_duration).strip() == "":
                raw_duration = call.get("Duration")
            duration = max(0, int(float(raw_duration or 0)))
        except (TypeError, ValueError):
            duration = 0
        status = str(call.get("Status") or "completed").lower()
        normalized_status = {"terminal": "completed", "busy": "busy", "no-answer": "no-answer"}.get(status, status)
        update = {
            "company_id": company_id,
            "channel_id": channel_id,
            "direction": direction,
            "from_phone": from_phone,
            "to_phone": to_phone,
            "destination_phone": to_phone,
            "caller_phone": from_phone,
            "caller_to": to_phone,
            "status": normalized_status,
            "duration_seconds": duration,
            "started_at": started_at,
            "provider_status": status,
            "provider_direction": call.get("Direction"),
            "provider_verified": True,
            "source_type": "phone_call",
            "is_archived": False,
        }
        if call.get("RecordingUrl"):
            update["recording_url"] = call["RecordingUrl"]
        if sid in existing_by_sid:
            await col_conversations().update_one({"_id": existing_by_sid[sid]["_id"]}, {"$set": update})
            updated += 1
        else:
            update.update({
                "agent_id": str(channel.get("agent_id") or ""),
                "call_sid": sid,
                "turn_count": 0,
                "is_pinned": False,
                "is_archived": False,
            })
            await col_conversations().insert_one(update)
            inserted += 1

    unmatched_query = {
        "company_id": company_id,
        "channel_id": channel_id,
        "call_sid": {"$exists": True, "$nin": [None, ""]},
        "started_at": {"$gte": start_utc},
    }
    async for doc in col_conversations().find(unmatched_query):
        if str(doc.get("call_sid")) in calls:
            continue
        result = await col_conversations().update_one(
            {"_id": doc["_id"]},
            {"$set": {
                "is_archived": True,
                "provider_verified": False,
                "provider_reconciliation_status": "not_found_in_exotel_window",
            }},
        )
        archived += result.modified_count

    return {"synced": True, "provider_calls": len(calls), "updated": updated, "inserted": inserted, "archived": archived}

class CreateChannelRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    type: str = Field(..., min_length=2, max_length=40)
    phone_number: Optional[str] = Field(default=None, max_length=32)
    agent_id: Optional[str] = Field(default=None, min_length=1, max_length=64)
    company_id: str = Field(..., min_length=1, max_length=64)
    is_active: bool = True

    @field_validator("name", "type", "company_id", "agent_id", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("phone_number", mode="before")
    @classmethod
    def validate_phone(cls, value):
        if value in (None, ""):
            return None
        value = str(value).replace(" ", "").replace("-", "").strip()
        if not re.fullmatch(r"\+?[1-9]\d{6,14}", value):
            raise ValueError("Invalid phone number. Use an international number, e.g. +919876543210.")
        return value

class GeneratePromptRequest(BaseModel):
    contact_name: str
    phone_number: str
    topic: str
    history_context: Optional[str] = None

@router.post("/channels/generate-prompt", summary="Generate a custom AI prompt for outbound call")
async def generate_prompt(body: GeneratePromptRequest):
    import os
    import httpx
    
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={GEMINI_API_KEY}"
    headers = {
        "Content-Type": "application/json"
    }
    
    system_instruction = "You are an expert prompt engineer. The user is triggering an AI agent outbound call. Write a short, highly effective system prompt (2-4 sentences) that will override the AI's default instructions. Output ONLY the raw prompt text, no intro or markdown."
    
    prompt_context = f"{system_instruction}\n\nThe contact's name is {body.contact_name or 'the customer'}. "
    if body.history_context:
        prompt_context += f"Context: {body.history_context} "
    prompt_context += f"The call objective/topic is: {body.topic}."
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt_context}]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 150
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                generated = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return {"success": True, "prompt": generated}
            else:
                return {"success": False, "error": f"LLM failed: {resp.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/channels", summary="Create a new channel")
async def create_channel(body: CreateChannelRequest):
    import datetime
    from core.database import col_channels
    from core.database import col_agents
    from core.exceptions import ConflictError

    if body.agent_id:
        try:
            agent = await col_agents().find_one({"_id": ObjectId(body.agent_id), "company_id": body.company_id})
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid agent ID.") from exc
        if not agent:
            raise NotFoundError("Agent")

    if body.phone_number and body.is_active:
        existing = await col_channels().find_one({"phone_number": body.phone_number, "is_active": True})
        if existing:
            raise ConflictError("Phone number is already in use by another active channel.")

    now = datetime.datetime.now(datetime.timezone.utc)
    new_channel = {
        "name": body.name,
        "type": body.type,
        "phone_number": body.phone_number.strip() if body.phone_number else None,
        "agent_id": body.agent_id,
        "company_id": body.company_id,
        "is_active": body.is_active,
        "created_at": now,
        "updated_at": now,
        "config": {}
    }
    res = await col_channels().insert_one(new_channel)
    await col_activity_logs().insert_one({
        "company_id": body.company_id,
        "action": "channel_created",
        "target": body.name,
        "details": f"Created {body.type} channel.",
        "resource_id": str(res.inserted_id),
        "created_at": now,
    })
    return {"success": True, "channel_id": str(res.inserted_id)}
@router.get("/channels", summary="List all channels across platform")
async def list_all_channels(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
):
    channels = await channel_service.list_all_channels_admin(skip=skip, limit=limit)
    
    def _fmt(doc):
        return {
            "id": str(doc["_id"]),
            "company_id": doc["company_id"],
            "agent_id": doc["agent_id"],
            "name": doc["name"],
            "type": doc["type"],
            "phone_number": doc.get("phone_number"),
            "public_identifier": doc.get("public_identifier"),
            "is_active": doc.get("is_active", True),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        }
        
    return {"channels": [_fmt(c) for c in channels], "count": len(channels)}

@router.get("/channels/{channel_id}", summary="Get channel details as admin")
async def get_channel_admin(channel_id: str):
    channel = await col_channels().find_one({"_id": ObjectId(channel_id)})
    if not channel:
        raise NotFoundError("Channel")
    # Get all Twilio voice channels for this company to determine phone number pool
    company_voice_channels = await col_channels().find({
        "company_id": channel["company_id"],
        "type": "twilio_voice",
        "is_active": True
    }).to_list(length=100)
    
    company_numbers = [c.get("phone_number") for c in company_voice_channels if c.get("phone_number")]
    
    allowed_domains = channel.get("config", {}).get("allowed_domains", ["Any (Not strict)"])
    if not isinstance(allowed_domains, list):
        allowed_domains = ["Any (Not strict)"]
        
    config = channel.get("config") or {}
    # Never return provider secrets to the browser. The UI receives only
    # non-sensitive integration metadata and a readiness flag.
    secret_keys = {"api_key", "api_token", "auth_token", "webhook_secret", "password"}
    safe_config = {key: value for key, value in config.items() if key.lower() not in secret_keys}
    channel_credentials = channel.get("credentials") or {}
    configured_account_sid = str(config.get("exotel_account_sid") or "").strip()
    channel_credentials_configured = bool(
        channel_credentials.get("api_key_encrypted") and channel_credentials.get("api_token_encrypted")
    )
    render_credentials_match = bool(
        settings.exotel_account_sid and settings.exotel_api_key and settings.exotel_api_token
        and (not configured_account_sid or configured_account_sid == settings.exotel_account_sid)
    )
    safe_config["provider_credentials_configured"] = bool(
        channel_credentials_configured or render_credentials_match
    ) if channel.get("type") in {"exotel", "exotel_voice"} else True

    return {
        "id": str(channel["_id"]),
        "company_id": channel["company_id"],
        "agent_id": channel.get("agent_id"),
        "name": channel["name"],
        "type": channel["type"],
        "phone_number": channel.get("phone_number"),
        "public_identifier": channel.get("public_identifier"),
        "is_active": channel.get("is_active", True),
        "created_at": channel.get("created_at"),
        "updated_at": channel.get("updated_at"),
        "company_numbers": company_numbers,
        "allowed_domains": allowed_domains
        ,"config": safe_config
    }


@router.post("/channels/{channel_id}/verify", summary="Verify provider channel configuration")
async def verify_channel_admin(channel_id: str):
    """Validate saved channel metadata and provider credentials without exposing secrets."""
    channel = await col_channels().find_one({"_id": ObjectId(channel_id)})
    if not channel:
        raise NotFoundError("Channel")

    config = channel.get("config") or {}
    channel_type = channel.get("type")
    is_exotel = channel_type in {"exotel", "exotel_voice"}
    checks = []

    def add_check(name: str, ok: bool, detail: str):
        checks.append({"name": name, "ok": bool(ok), "detail": detail})

    add_check("Channel name", bool(str(channel.get("name") or "").strip()), "Saved channel name")
    add_check("Phone number", bool(str(channel.get("phone_number") or "").strip()), "Saved provider number")

    if is_exotel:
        from core.security import decrypt_secret
        channel_credentials = channel.get("credentials") or {}
        api_key = decrypt_secret(channel_credentials.get("api_key_encrypted", ""))
        api_token = decrypt_secret(channel_credentials.get("api_token_encrypted", ""))
        account_sid = str(config.get("exotel_account_sid") or settings.exotel_account_sid or "").strip()
        flow_id = str(config.get("exotel_flow_id") or "").strip()
        voicebot_url = str(config.get("voicebot_url") or "").strip()
        status_url = str(config.get("status_url") or "").strip()
        add_check("Exotel account ID", bool(account_sid), account_sid or "Missing")
        add_check("Exotel flow ID", bool(flow_id), flow_id or "Missing")
        add_check("Voicebot callback URL", voicebot_url.startswith("https://"), "HTTPS URL required")
        add_check("Status callback URL", status_url.startswith("https://"), "HTTPS URL required")
        using_channel_credentials = bool(api_key and api_token)
        if not using_channel_credentials and account_sid == settings.exotel_account_sid:
            api_key = settings.exotel_api_key
            api_token = settings.exotel_api_token
        creds_ok = bool(account_sid and api_key and api_token)
        credential_detail = (
            "Encrypted channel credentials configured" if using_channel_credentials else
            "Render fallback credentials configured" if account_sid == settings.exotel_account_sid else
            f"Credentials for {account_sid} are required; Render fallback is {settings.exotel_account_sid or 'not configured'}"
        )
        add_check("Backend credentials", creds_ok, credential_detail)

        provider_ok = False
        provider_detail = "Not checked"
        if creds_ok:
            try:
                import httpx
                url = f"https://{settings.exotel_subdomain}/v1/Accounts/{account_sid}.json"
                async with httpx.AsyncClient(timeout=8.0) as client:
                    response = await client.get(url, auth=(api_key, api_token))
                provider_ok = response.status_code == 200
                provider_detail = "Exotel account reachable" if provider_ok else f"Exotel returned HTTP {response.status_code}"
            except Exception as exc:
                provider_detail = "Provider request failed"
        add_check("Provider reachability", provider_ok, provider_detail)
    else:
        creds_ok = bool(settings.twilio_account_sid and settings.twilio_auth_token)
        add_check("Backend credentials", creds_ok, "Render credentials configured" if creds_ok else "Render Twilio credentials missing")

    return {
        "valid": all(item["ok"] for item in checks),
        "provider": "Exotel" if is_exotel else "Twilio",
        "checks": checks,
    }


@router.post("/channels/{channel_id}/callback-urls", summary="Generate signed Exotel callback URLs")
async def generate_channel_callback_urls(channel_id: str):
    """Generate the channel-scoped Exotel URLs used by the Studio Voicebot flow."""
    channel = await col_channels().find_one({"_id": ObjectId(channel_id)})
    if not channel:
        raise NotFoundError("Channel")
    if channel.get("type") not in {"exotel", "exotel_voice"}:
        raise HTTPException(status_code=400, detail="Callback URLs are only available for Exotel channels")

    from core.webhook_security import build_signed_callback_query, get_exotel_webhook_secret
    company_id = str(channel.get("company_id"))
    agent_id = str(channel.get("agent_id") or "")
    channel_id_str = str(channel["_id"])
    callback_value = f"exotel:{company_id}:{agent_id}:{channel_id_str}"
    callback_query = build_signed_callback_query(get_exotel_webhook_secret(), callback_value)
    base_url = settings.app_base_url.rstrip("/")
    prefix = f"{base_url}/api/v1/webhook/exotel/advanced/{company_id}/{agent_id}"
    return {
        "voicebot_url": f"{prefix}/voicebot?channel_id={channel_id_str}&{callback_query}",
        "status_url": f"{prefix}/status?channel_id={channel_id_str}&{callback_query}",
        "expires_in_seconds": 86400,
    }

@router.get("/channels/{channel_id}/conversations", summary="Get conversations for a channel")
async def get_channel_conversations(channel_id: str, limit: int = 50, sync_provider: bool = False):
    channel = await col_channels().find_one({"_id": ObjectId(channel_id)})
    if not channel:
        raise NotFoundError("Channel")

    if sync_provider and channel.get("type") in {"exotel", "exotel_voice"}:
        now = time.monotonic()
        last_sync = _exotel_history_sync_at.get(channel_id, 0)
        if now - last_sync >= 30:
            _exotel_history_sync_at[channel_id] = now
            try:
                result = await _sync_exotel_history(channel)
                logger.info("[EXOTEL_HISTORY_SYNC] channel=%s result=%s", channel_id, result)
            except Exception as exc:
                logger.warning("[EXOTEL_HISTORY_SYNC] skipped: %s", type(exc).__name__)
    
    query = channel_conversation_query(channel)

    # Import provider-side calls that were created before the local
    # conversation webhook completed. This keeps the admin history complete.
    if channel.get("type") == "twilio_voice" and channel.get("phone_number"):
        now = time.monotonic()
        last_sync = _twilio_history_sync_at.get(channel_id, 0)
        if now - last_sync >= 15:
            _twilio_history_sync_at[channel_id] = now
            try:
                from modules.telephony.providers.twilio import TwilioTelephonyProvider
                from datetime import timezone
                provider = TwilioTelephonyProvider()
                if provider.client:
                    line = str(channel["phone_number"])
                    provider_calls = list(provider.client.calls.list(from_=line, limit=100))
                    provider_calls += list(provider.client.calls.list(to=line, limit=100))
                    existing = await col_conversations().find({
                        "company_id": str(channel["company_id"]),
                        "call_sid": {"$in": [str(item.sid) for item in provider_calls]},
                    }).to_list(length=None)
                    existing_sids = {str(item.get("call_sid")) for item in existing}
                    status_map = {
                        "queued": "calling", "initiated": "calling",
                        "ringing": "ringing", "in-progress": "in-progress",
                        "completed": "completed", "failed": "failed",
                        "busy": "busy", "no-answer": "no-answer",
                        "canceled": "canceled",
                    }
                    missing_docs = []
                    for item in provider_calls:
                        if str(item.sid) in existing_sids:
                            continue
                        from_number = str(getattr(item, "from_", "") or "")
                        to_number = str(getattr(item, "to", "") or "")
                        outbound = from_number.replace("+", "") == line.replace("+", "")
                        started_at = getattr(item, "start_time", None) or getattr(item, "date_created", None)
                        ended_at = getattr(item, "end_time", None)
                        status = status_map.get(str(getattr(item, "status", "") or "").lower(), "failed")
                        missing_docs.append({
                            "company_id": str(channel["company_id"]),
                            "agent_id": str(channel.get("agent_id") or ""),
                            "channel_id": channel_id,
                            "call_sid": str(item.sid),
                            "caller_phone": from_number,
                            "caller_to": to_number,
                            "from_phone": from_number,
                            "to_phone": to_number,
                            "destination_phone": to_number,
                            "direction": "outbound" if outbound else "inbound",
                            "source_type": "phone_call",
                            "language": "en-IN",
                            "status": status,
                            "provider_status": str(getattr(item, "status", "") or ""),
                            "started_at": started_at,
                            "ended_at": ended_at,
                            "duration_seconds": int(getattr(item, "duration", 0) or 0),
                            "turn_count": 0,
                            "booking_confirmed": False,
                            "appointment_data": None,
                            "is_pinned": False,
                            "title": "Voice Call",
                        })
                    if missing_docs:
                        await col_conversations().insert_many(missing_docs)
            except Exception as exc:
                logger.warning("Twilio history import skipped: %s", type(exc).__name__)

    cursor = col_conversations().find(query).sort("started_at", -1).limit(limit)
    convs = await cursor.to_list(length=limit)

    # A status callback can be delayed or unavailable while a provider call has
    # already ended. Reconcile only active Twilio calls so history never stays
    # stuck on "calling" after the carrier has returned a terminal status.
    reconcile_candidates = [
        doc for doc in convs
        if str(doc.get("call_sid") or "").startswith("CA")
        and str(doc.get("status") or "").lower() not in {
            "completed", "failed", "busy", "no-answer", "no_answer",
            "canceled", "cancelled", "hung-up",
        }
    ]
    if reconcile_candidates:
        try:
            from datetime import datetime, timezone
            from modules.telephony.providers.twilio import TwilioTelephonyProvider

            provider = TwilioTelephonyProvider()
            status_map = {
                "queued": "calling", "initiated": "calling",
                "ringing": "ringing", "in-progress": "in-progress",
                "completed": "completed", "failed": "failed",
                "busy": "busy", "no-answer": "no-answer",
                "no_answer": "no-answer", "canceled": "canceled",
                "cancelled": "canceled",
            }
            for doc in reconcile_candidates:
                provider_status = str(await provider.get_call_status(str(doc["call_sid"])) or "").lower()
                normalized = status_map.get(provider_status)
                if not normalized or normalized == str(doc.get("status") or "").lower():
                    continue
                update = {"status": normalized, "provider_status": provider_status}
                if normalized in {"completed", "failed", "busy", "no-answer", "canceled"}:
                    update["ended_at"] = datetime.now(timezone.utc)
                await col_conversations().update_one({"_id": doc["_id"]}, {"$set": update})
                doc.update(update)
        except Exception as exc:
            logger.debug("Twilio history status reconciliation skipped: %s", type(exc).__name__)
    
    phones = set()
    for doc in convs:
        p = doc.get("caller_phone") or doc.get("from_phone") or doc.get("to_phone")
        if p:
            digits = re.sub(r"\D", "", p)
            if len(digits) >= 10:
                phones.add(digits[-10:])

    contact_map = {}
    if phones:
        try:
            from core.database import col_leads
            lead_docs = await col_leads().find(
                {"company_id": str(channel["company_id"]), "phone": {"$regex": f"({'|'.join(phones)})$"}}
            ).to_list(None)
            for lead in lead_docs:
                p_clean = re.sub(r"\D", "", lead.get("phone", ""))[-10:]
                if p_clean and lead.get("name"):
                    contact_map[p_clean] = lead["name"]

            prior_named = await col_conversations().find(
                {
                    "company_id": str(channel["company_id"]),
                    "contact_name": {"$exists": True, "$ne": None, "$nin": ["", "Unknown", "inbound", "None"]}
                },
                {"caller_phone": 1, "from_phone": 1, "to_phone": 1, "destination_phone": 1, "direction": 1, "contact_name": 1}
            ).to_list(100)
            for pc in prior_named:
                p_dir = pc.get("direction", "inbound")
                cust_candidate = (pc.get("to_phone") or pc.get("destination_phone")) if p_dir == "outbound" else (pc.get("caller_phone") or pc.get("from_phone"))
                if cust_candidate:
                    cand_clean = re.sub(r"\D", "", cust_candidate)[-10:]
                    if cand_clean and cand_clean not in contact_map and pc.get("contact_name"):
                        contact_map[cand_clean] = pc["contact_name"]
        except Exception as c_err:
            logger.debug("Contact batch prefetch skipped: %s", c_err)

    def _fmt(doc):
        direction = doc.get("direction", "inbound")
        caller_phone = doc.get("caller_phone")
        caller_to = doc.get("caller_to")
        channel_phone = channel.get("phone_number")
        phone_key = re.sub(r"\D", "", caller_phone or doc.get("from_phone") or doc.get("to_phone") or "")[-10:]
        resolved_contact = doc.get("contact_name") or contact_map.get(phone_key)
        legacy_from_is_channel = bool(
            direction == "outbound"
            and channel_phone
            and caller_to
            and str(caller_to).replace("+", "") == str(channel_phone).replace("+", "")
        )
        if direction == "outbound":
            from_phone = doc.get("from_phone") or (caller_to if legacy_from_is_channel else caller_phone)
            to_phone = doc.get("destination_phone") or doc.get("to_phone") or (caller_phone if legacy_from_is_channel else caller_to)
        else:
            from_phone = doc.get("from_phone") or caller_phone
            to_phone = channel_phone or doc.get("to_phone") or doc.get("destination_phone") or caller_to
        return {
            "id": str(doc["_id"]),
            "company_id": str(doc.get("company_id", "")),
            "agent_id": str(doc["agent_id"]) if doc.get("agent_id") else None,
            "caller_phone": caller_phone,
            "caller_to": caller_to,
            "from_phone": from_phone,
            "to_phone": to_phone,
            "contact_name": resolved_contact,
            "destination_phone": to_phone,
            "recording_url": doc.get("recording_url"),
            "status": doc.get("status"),
            "created_at": doc.get("started_at") or doc.get("created_at"),
            "ended_at": doc.get("ended_at"),
            "duration_seconds": doc.get("duration_seconds", 0),
            "turn_count": doc.get("turn_count", 0),
            "title": doc.get("title", "Voice Call"),
            "direction": direction,
            "call_sid": doc.get("call_sid"),
            "failure_reason": doc.get("failure_reason"),
            "provider_status": doc.get("provider_status"),
            "provider_verified": doc.get("provider_verified"),
            "is_archived": bool(doc.get("is_archived", False)),
        }
        
    return {"conversations": [_fmt(c) for c in convs]}

@router.get("/conversations/by-call-sid/{call_sid}", summary="Get live conversation by call SID")
async def get_conversation_by_call_sid(call_sid: str):
    conv = await col_conversations().find_one({"call_sid": call_sid})
    if not conv:
        raise NotFoundError("Conversation")

    # Keep the live monitor accurate even if a provider callback is delayed or
    # rejected by a proxy. Twilio is authoritative for the call lifecycle.
    current_status = str(conv.get("status") or "").lower()
    terminal_statuses = {"completed", "failed", "busy", "no-answer", "no_answer", "canceled", "cancelled", "hung-up"}
    if call_sid.startswith("CA") and current_status not in terminal_statuses:
        try:
            from modules.telephony.providers.twilio import TwilioTelephonyProvider
            from datetime import datetime, timezone
            provider_status = str(await TwilioTelephonyProvider().get_call_status(call_sid) or "").lower()
            status_map = {
                "queued": "calling",
                "initiated": "calling",
                "in-progress": "in-progress",
                "ringing": "ringing",
                "completed": "completed",
                "failed": "failed",
                "busy": "busy",
                "no-answer": "no-answer",
                "no_answer": "no-answer",
                "canceled": "canceled",
                "cancelled": "canceled",
            }
            normalized = status_map.get(provider_status)
            if normalized and normalized != current_status:
                update = {"status": normalized, "provider_status": provider_status}
                if normalized in {"completed", "failed", "busy", "no-answer", "canceled"}:
                    update["ended_at"] = datetime.now(timezone.utc)
                await col_conversations().update_one({"_id": conv["_id"]}, {"$set": update})
                conv.update(update)
        except Exception as exc:
            logger.debug("Twilio live status reconciliation skipped: %s", type(exc).__name__)
        
    messages = await col_messages().find({"conversation_id": str(conv["_id"])}).sort("created_at", 1).to_list(None)
    
    return {
        "id": str(conv["_id"]),
        "company_id": str(conv.get("company_id", "")),
        "status": conv.get("status", "in_progress"),
        "recording_url": conv.get("recording_url"),
        "call_sid": conv.get("call_sid"),
        "agent_id": conv.get("agent_id"),
        "call_started_at": conv.get("started_at"),
        "ringing_started_at": conv.get("ringing_started_at") or conv.get("started_at"),
        "answered_at": conv.get("answered_at"),
        "ended_at": conv.get("ended_at"),
        "duration_seconds": conv.get("duration_seconds", 0),
        "failure_reason": conv.get("failure_reason"),
        "messages": [
            {
                "id": str(m["_id"]),
                "role": m.get("role"),
                "content": m.get("text") or m.get("content") or "",
                "created_at": m.get("timestamp") or m.get("created_at")
            } for m in messages
        ]
    }

@router.post("/conversations/by-call-sid/{call_sid}/end", summary="End a live Exotel call")
async def end_live_call(call_sid: str):
    conv = await col_conversations().find_one({"call_sid": call_sid})
    if not conv:
        raise NotFoundError("Conversation")
        
    channel = await col_channels().find_one({"company_id": conv.get("company_id"), "type": {"$in": ["twilio_voice", "enablex_voice", "enablex"]}})
    if channel:
        if channel.get("type") in ["enablex", "enablex_voice"]:
            import os
            import requests
            from dotenv import dotenv_values
            env_dict = dotenv_values(".env")
            app_id = env_dict.get("ENABLEX_APP_ID")
            app_key = env_dict.get("ENABLEX_APP_KEY")
            if app_id and app_key:
                url = f"https://api.enablex.io/voice/v1/call/{call_sid}"
                try:
                    requests.delete(url, auth=(app_id, app_key))
                except Exception as e:
                    logger.error(f"Failed to end EnableX call: {e}")
        elif channel.get("credentials"):
            exotel_sid = channel["credentials"].get("account_sid")
            exotel_token = channel["credentials"].get("auth_token")
            exotel_key = channel["credentials"].get("api_key")
            if exotel_sid and exotel_token and exotel_key:
                import requests
                from requests.auth import HTTPBasicAuth
                url = f"https://api.exotel.com/v1/Accounts/{exotel_sid}/Calls/{call_sid}.json"
                try:
                    requests.post(url, data={"Status": "completed"}, auth=HTTPBasicAuth(exotel_key, exotel_token))
                except:
                    pass
                
    from services.conversation_service import end_conversation
    await end_conversation(call_sid=call_sid, status="completed")
    return {"success": True}

class TestCallRequest(BaseModel):
    contact_name: str
    phone_number: str
    topic: str
    system_prompt: Optional[str] = None

class ScheduledCallRequest(BaseModel):
    contact_name: str
    phone_number: str
    topic: str
    system_prompt: Optional[str] = None
    scheduled_at: str

from datetime import datetime, timezone
import dateutil.parser

@router.post("/channels/{channel_id}/schedule-call", summary="Schedule an outbound test call")
async def schedule_test_call(
    channel_id: str,
    body: ScheduledCallRequest,
    channel_context: dict = Depends(require_channel_admin),
):
    channel = channel_context if isinstance(channel_context, dict) else await col_channels().find_one({"_id": ObjectId(channel_id)})
    if not channel:
        raise NotFoundError("Channel")
    
    try:
        run_date = dateutil.parser.isoparse(body.scheduled_at)
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid datetime format for scheduled_at. Use ISO 8601.")
    if run_date.tzinfo is None:
        run_date = run_date.replace(tzinfo=timezone.utc)
    else:
        run_date = run_date.astimezone(timezone.utc)

    req = TestCallRequest(
        contact_name=body.contact_name,
        phone_number=body.phone_number,
        topic=body.topic,
        system_prompt=body.system_prompt
    )
    
    from services.job_queue import enqueue_scheduled_call
    job_id = await enqueue_scheduled_call(
        channel_id=channel_id,
        company_id=channel["company_id"],
        scheduled_at=run_date,
        payload={
            "channel_id": channel_id,
            "request": req.model_dump(),
        },
    )

    return {"success": True, "job_id": job_id, "message": f"Call scheduled for {run_date}"}

@router.post("/channels/{channel_id}/test-call", summary="Trigger outbound test call")
async def trigger_test_call(channel_id: str, body: TestCallRequest):
    import logging
    logger = logging.getLogger("api.admin.channels")
    logger.info(f"Executing trigger_test_call for channel {channel_id} with number {body.phone_number}")
    
    channel = await col_channels().find_one({"_id": ObjectId(channel_id)})
    if not channel:
        raise NotFoundError("Channel")
    
    # We need a Twilio number to call FROM.
    # Get all Twilio voice channels for this company to determine phone number pool
    company_voice_channels = await col_channels().find({
        "company_id": channel["company_id"],
        "type": "twilio_voice",
        "is_active": True
    }).to_list(length=100)
    
    try:
        import requests
        from requests.auth import HTTPBasicAuth
        import os
        from dotenv import dotenv_values
        
        company_id = str(channel.get("company_id", ""))
        agent_id = str(channel.get("agent_id", ""))
        channel_id_str = str(channel.get('_id', ''))
        
        env_dict = dotenv_values(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env"))
        actual_webhook = env_dict.get("PLATFORM_WEBHOOK_BASE_URL", settings.platform_webhook_base_url)
        dest_number = body.phone_number.replace(" ", "").replace("-", "").strip()
        
        import urllib.parse
        # These values are passed through Twilio's signed webhook request and
        # become custom Media Stream parameters for the live agent.
        outbound_query = urllib.parse.urlencode({
            "contact_name": body.contact_name or "",
            "topic": body.topic or "",
            "system_prompt": body.system_prompt or "",
        })
        
        if channel.get("type") == "twilio_voice":
            from modules.telephony.providers.twilio import TwilioTelephonyProvider
            twilio_provider = TwilioTelephonyProvider()
            
            twiml_url = f"{actual_webhook}/api/v1/webhook/twilio/twiml/{company_id}/{agent_id}/{channel_id_str}?{outbound_query}"
            status_webhook_url = f"{actual_webhook}/api/v1/webhook/twilio/status/{company_id}/{agent_id}/{channel_id_str}"
            stream_base = str(actual_webhook).rstrip("/")
            stream_base = stream_base.replace("https://", "wss://").replace("http://", "ws://")
            stream_url = f"{stream_base}/api/v1/webhook/twilio/media-stream"
            logger.info("ðŸ“¡ Sending call request to Twilio...")
            call_sid = await twilio_provider.create_call(
                to_phone=dest_number,
                from_phone="system_default",
                webhook_url=twiml_url,
                metadata={"status_callback": status_webhook_url},
            )
            
            if call_sid.startswith("error") or call_sid.startswith("mock_fail"):
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail="Twilio call creation failed.")
                
            # Pre-create conversation
            from services.conversation_service import create_conversation
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(create_conversation(
                    company_id=company_id,
                    agent_id=agent_id,
                    channel_id=channel_id_str,
                    call_sid=call_sid,
                    caller_phone=settings.twilio_default_phone_number,
                    caller_to=dest_number,
                    from_phone=settings.twilio_default_phone_number,
                    to_phone=dest_number,
                    destination_phone=dest_number,
                    contact_name=body.contact_name or None,
                    direction="outbound"
                ))
            except Exception as loop_e:
                logger.error(f"Failed to schedule create_conversation task: {loop_e}")

            return {"success": True, "call_sid": call_sid, "message": f"Dialing {dest_number} from Twilio..."}
            
        elif channel.get("type") == "enablex_voice":
            app_id = env_dict.get("ENABLEX_APP_ID")
            app_key = env_dict.get("ENABLEX_APP_KEY")
            from_number = channel.get("phone_number", "+917935465526")

            # The EnableX portal lists the number as 917935465526 (no plus sign)
            from_num_clean = from_number.replace("+", "")
            to_num_clean = dest_number
            if len(to_num_clean) == 10:
                to_num_clean = "+91" + to_num_clean
            if not to_num_clean.startswith("+"):
                to_num_clean = "+" + to_num_clean

            scheme = "wss" if actual_webhook.startswith("https://") else "ws"
            host = actual_webhook.replace("https://", "").replace("http://", "")
            ws_url = f"{scheme}://{host}/api/v1/webhook/enablex/media-stream?caller={to_num_clean}&to={from_num_clean}"
            event_url = f"{actual_webhook}/api/v1/webhook/enablex/events"

            answer_url = f"{actual_webhook}/api/v1/webhook/enablex"
            
            payload = {
                "name": "Outbound Call ZeniaAI",
                "owner_ref": "zenia_outbound",
                "to": to_num_clean,
                "from": from_num_clean,
                "record": True,
                "answer_url": answer_url,
                "event_url": event_url
            }

            url = "https://api.enablex.io/voice/v1/call"
            logger.info("ðŸ“¡ Sending outbound call request to EnableX...")
            response = requests.post(
                url,
                json=payload,
                auth=HTTPBasicAuth(app_id, app_key),
                headers={"Content-Type": "application/json"}
            )

            if response.status_code in [200, 201, 202]:
                resp_data = response.json()
                call_sid = resp_data.get("voice_id", f"enx_out_{dest_number}")
                
                # Pre-create conversation so it appears in history immediately
                from services.conversation_service import create_conversation
                import asyncio
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(create_conversation(
                        company_id=channel.get("company_id"),
                        agent_id=channel.get("agent_id"),
                        channel_id=str(channel.get("_id")),
                        call_sid=call_sid,
                        caller_phone=from_number,
                        caller_to=to_num_clean,
                        from_phone=from_number,
                        to_phone=to_num_clean,
                        destination_phone=to_num_clean,
                        direction="outbound"
                    ))
                except Exception as loop_e:
                    logger.error(f"Failed to schedule create_conversation task: {loop_e}")

                return {"success": True, "call_sid": call_sid, "message": f"Dialing {dest_number} from EnableX..."}
            else:
                from fastapi import HTTPException
                err_detail = response.text
                logger.error(f"EnableX API Error: {err_detail}")
                raise HTTPException(status_code=400, detail=f"EnableX call creation failed: {err_detail}")
            
        else:
            # Exotel logic
            from_number = (channel.get("phone_number") or env_dict.get("EXOTEL_PHONE_NUMBER") or "").strip()
            if not from_number:
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail="Exotel channel phone number is required")
            
            from core.security import decrypt_secret
            channel_credentials = channel.get("credentials") or {}
            channel_config = channel.get("config") or {}
            exotel_sid = str(channel_config.get("exotel_account_sid") or settings.exotel_account_sid or "")
            exotel_key = decrypt_secret(channel_credentials.get("api_key_encrypted", "")) or settings.exotel_api_key
            exotel_token = decrypt_secret(channel_credentials.get("api_token_encrypted", "")) or settings.exotel_api_token
            exotel_subdomain = settings.exotel_subdomain
            if not all((exotel_sid, exotel_key, exotel_token)):
                raise HTTPException(status_code=503, detail="Exotel credentials are not configured")
            
            webhook_url = f"{settings.app_base_url.replace('localhost', '127.0.0.1')}/api/v1/webhook/exotel/advanced/{company_id}/{agent_id}/voice"
            if "loca.lt" in actual_webhook or "ngrok" in actual_webhook or "trycloudflare.com" in actual_webhook:
                webhook_url = f"{actual_webhook}/api/v1/webhook/exotel/advanced/{company_id}/{agent_id}/voice"
                
            host = actual_webhook.replace("https://", "").replace("http://", "")
            scheme = "wss" if "localhost" not in host and "127.0.0.1" not in host else "ws"
            ws_url = f"{scheme}://{host}/api/v1/webhook/exotel/advanced/{company_id}/{agent_id}/media-stream"
            
            from core.webhook_security import build_signed_callback_query
            callback_value = f"exotel:{company_id}:{agent_id}:{channel_id_str}"
            from core.webhook_security import get_exotel_webhook_secret
            callback_query = build_signed_callback_query(get_exotel_webhook_secret(), callback_value)
            webhook_url += f"?channel_id={channel_id_str}&{callback_query}"
            
            url = f"https://{exotel_subdomain}/v1/Accounts/{exotel_sid}/Calls/connect.json"
            status_webhook_url = f"{actual_webhook}/api/v1/webhook/exotel/advanced/{company_id}/{agent_id}/status?channel_id={channel_id_str}&{callback_query}"
            
            # This is the ExoML/Studio flow that was verified for outbound
            # calls. Keep the known-working flow instead of using the channel
            # form's unrelated/configured flow value.
            exotel_app_url = f"http://my.exotel.com/{exotel_sid}/exoml/start_voice/1355682"
            
            payload = {
                "From": dest_number,
                "CallerId": from_number,
                "Url": exotel_app_url,
                "CallType": "trans",
                "StatusCallback": status_webhook_url
            }
            
            import time
            start_time = time.time()
            response = requests.post(url, data=payload, auth=HTTPBasicAuth(exotel_key, exotel_token))
            
            if response.status_code in [200, 201]:
                resp_data = response.json()
                call_sid = resp_data.get("Call", {}).get("Sid", "unknown")
                logger.info(f"Exotel call success. SID: {call_sid}")
                
                # PRE-CREATE CONVERSATION
                from services.conversation_service import create_conversation
                import asyncio
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(create_conversation(
                        company_id=company_id,
                        agent_id=agent_id,
                        channel_id=channel_id_str,
                        call_sid=call_sid,
                        caller_phone=from_number,
                        caller_to=dest_number,
                        from_phone=from_number,
                        to_phone=dest_number,
                        destination_phone=dest_number,
                        contact_name=body.contact_name or None,
                        direction="outbound"
                    ))
                except Exception as loop_e:
                    logger.error(f"Failed to schedule create_conversation task: {loop_e}")

                return {"success": True, "call_sid": call_sid, "message": f"Dialing {dest_number} from Exotel {from_number}..."}
            else:
                try:
                    err_msg = response.json().get("RestException", {}).get("Message", response.text)
                except:
                    err_msg = response.text
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail=f"Exotel call creation failed: {err_msg}")
            
    except Exception as e:
        logger.error(f"Failed to trigger call: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/channels/{channel_id}/analytics", summary="Get comprehensive channel analytics")
async def get_channel_analytics(channel_id: str):
    from collections import Counter, defaultdict
    import datetime

    channel = await col_channels().find_one({"_id": ObjectId(channel_id)})
    if not channel:
        raise NotFoundError("Channel")

    company_id = str(channel.get("company_id", ""))

    # Use the same tenant-scoped line attribution as channel history.
    query = channel_conversation_query(channel)

    convs = await col_conversations().find(query).to_list(None)

    total_calls = len(convs)
    completed_calls = sum(1 for c in convs if c.get("status") == "completed")
    failed_calls = sum(1 for c in convs if c.get("status") in ["failed", "hung-up", "busy", "no-answer"])
    active_calls = sum(1 for c in convs if c.get("status") in ["in-progress", "active", "ringing"])
    
    inbound_calls = sum(1 for c in convs if c.get("direction", "inbound").lower() == "inbound")
    outbound_calls = sum(1 for c in convs if c.get("direction", "inbound").lower() == "outbound")

    total_duration = sum(c.get("duration_seconds", 0) for c in convs)
    avg_duration = int(total_duration / total_calls) if total_calls > 0 else 0
    # Use standard half-up percentage rounding so every UI surface reports
    # the same value (for example, 10/16 = 62.5% -> 63%).
    answer_rate = int((completed_calls / total_calls) * 100 + 0.5) if total_calls > 0 else 0
    recordings_count = sum(1 for c in convs if c.get("recording_url"))
    transcript_calls = sum(1 for c in convs if c.get("turn_count", 0) > 0 or c.get("message_count", 0) > 0)

    recording_pct = int((recordings_count / total_calls) * 100) if total_calls > 0 else 0
    transcript_pct = int((transcript_calls / total_calls) * 100) if total_calls > 0 else 0

    # --- Outcomes breakdown ---
    outcomes_counter = Counter(c.get("status", "unknown") for c in convs)
    outcomes = [{"status": k.replace("-", " ").title(), "count": v} for k, v in sorted(outcomes_counter.items(), key=lambda x: -x[1])]

    # --- Call trend by day ---
    daily_calls = defaultdict(int)
    for c in convs:
        dt = c.get("started_at") or c.get("created_at")
        if dt and isinstance(dt, datetime.datetime):
            daily_calls[dt.strftime("%Y-%m-%d")] += 1
    call_trend = [{"date": k, "calls": v} for k, v in sorted(daily_calls.items())]

    # --- Recent 5 calls with FULL data for drawer ---
    sorted_convs = sorted(
        convs,
        key=lambda x: x.get("started_at") or x.get("created_at") or datetime.datetime.min.replace(tzinfo=datetime.timezone.utc),
        reverse=True
    )
    recent_calls = []
    for c in sorted_convs[:5]:
        started = c.get("started_at") or c.get("created_at")
        ended = c.get("ended_at")
        recent_calls.append({
            "id": str(c["_id"]),
            "company_id": company_id,
            "caller_phone": c.get("caller_phone") or None,
            "caller_to": c.get("caller_to") or None,
            "contact_name": c.get("contact_name") or None,
            "direction": c.get("direction", "inbound"),
            "status": c.get("status", "unknown"),
            "created_at": started.isoformat() if started else None,
            "ended_at": ended.isoformat() if ended else None,
            "duration_seconds": c.get("duration_seconds", 0),
            "turn_count": c.get("turn_count", 0),
            "recording_url": c.get("recording_url") or None,
            "call_sid": c.get("call_sid") or None,
            "title": c.get("title", "Voice Call"),
        })

    # --- Subscription / usage data (real data from DB) ---
    sub = await col_subscriptions().find_one({"company_id": company_id})
    usage_record = await col_usage_records().find_one(
        {"company_id": company_id},
        sort=[("month", -1)]
    )
    
    subscription_data = None
    if sub:
        limits = sub.get("limits", {})
        max_call_minutes = limits.get("max_call_minutes")
        
        # Total call minutes for this channel (from conversations)
        channel_call_minutes = round(total_duration / 60, 2)
        
        subscription_data = {
            "plan": sub.get("plan", "unknown"),
            "status": sub.get("status", "unknown"),
            "max_call_minutes": max_call_minutes,
            "channel_call_minutes": channel_call_minutes,
        }
        
        # Add company-wide usage if available
        if usage_record:
            subscription_data["company_call_minutes_used"] = round(usage_record.get("call_minutes_used", 0), 2)
            subscription_data["company_call_count"] = usage_record.get("call_count", 0)
            subscription_data["usage_month"] = usage_record.get("month")

    return {
        "total_calls": total_calls,
        "inbound_calls": inbound_calls,
        "outbound_calls": outbound_calls,
        "completed_calls": completed_calls,
        "failed_calls": failed_calls,
        "active_calls": active_calls,
        "total_duration": total_duration,
        "average_duration": avg_duration,
        "answer_rate": answer_rate,
        "recordings_count": recordings_count,
        "transcript_calls": transcript_calls,
        "recording_pct": recording_pct,
        "transcript_pct": transcript_pct,
        "outcomes": outcomes,
        "call_trend": call_trend,
        "recent_calls": recent_calls,
        "subscription": subscription_data,
        # No fake cost/rupee data - cost_data is not configured in this system
        "cost_data_available": False,
    }

@router.get("/channels/{channel_id}/scheduled-calls", summary="List scheduled calls for a channel")
async def list_scheduled_calls(
    channel_id: str,
    channel_context: dict = Depends(require_channel_admin),
):
    cursor = col_scheduled_calls().find({"channel_id": channel_id, "status": {"$in": ["pending", "running"]}}).sort("scheduled_at", 1)
    channel_jobs = []
    async for job in cursor:
        req = (job.get("payload") or {}).get("request") or {}
        channel_jobs.append({
            "id": str(job["_id"]),
            "scheduled_at": job.get("scheduled_at").isoformat() if job.get("scheduled_at") else None,
            "status": job.get("status"),
            "contact_name": req.get("contact_name", ""),
            "phone_number": req.get("phone_number", ""),
            "topic": req.get("topic", ""),
        })
    return {"success": True, "jobs": channel_jobs}

@router.delete("/channels/{channel_id}/scheduled-calls/{job_id}", summary="Cancel a scheduled call")
async def cancel_scheduled_call(
    channel_id: str,
    job_id: str,
    channel_context: dict = Depends(require_channel_admin),
):
    try:
        if ObjectId.is_valid(job_id):
            result = await col_scheduled_calls().update_one(
                {"_id": ObjectId(job_id), "channel_id": channel_id, "status": {"$in": ["pending", "running"]}},
                {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
            )
            if result.matched_count:
                return {"success": True, "message": "Call cancelled successfully."}
            exists = await col_scheduled_calls().find_one({"_id": ObjectId(job_id)})
            if exists:
                if exists.get("channel_id") != channel_id:
                    return {"success": False, "error": "Unauthorized: Job does not belong to this channel"}
                return {"success": False, "error": "Scheduled job not found"}

        # Compatibility for jobs created by releases before the durable queue
        # migration. New jobs never use this in-memory path.
        from tasks.daily_sync import _scheduler
        legacy_job = _scheduler.get_job(job_id)
        if not legacy_job:
            return {"success": False, "error": "Scheduled job not found"}
        if not (legacy_job.args and len(legacy_job.args) >= 1 and str(legacy_job.args[0]) == str(channel_id)):
            return {"success": False, "error": "Unauthorized: Job does not belong to this channel"}
        _scheduler.remove_job(job_id)
        return {"success": True, "message": "Call cancelled successfully."}
    except Exception as e:
        return {"success": False, "error": str(e)}
