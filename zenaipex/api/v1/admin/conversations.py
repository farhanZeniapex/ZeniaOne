from fastapi import APIRouter, Depends, Path, Query, Request, HTTPException
from fastapi.responses import StreamingResponse
from core.database import col_conversations, col_messages, col_channels
from core.dependencies import get_auth_context, AuthContext, get_platform_admin
from core.exceptions import NotFoundError
from services import conversation_service
from typing import Optional
from bson import ObjectId
import httpx
import jwt
import ipaddress
import socket
from urllib.parse import urlparse
from core.config import settings

router = APIRouter(prefix="/conversations", tags=["Admin Conversations"])
public_router = APIRouter(prefix="/conversations", tags=["Admin Conversations Media"])

def _fmt_conv(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "company_id": str(doc["company_id"]),
        "agent_id": str(doc["agent_id"]) if doc.get("agent_id") else None,
        "caller_phone": doc.get("caller_phone"),
        "caller_to": doc.get("caller_to"),
        "from_phone": doc.get("from_phone") or doc.get("caller_phone"),
        "to_phone": doc.get("to_phone") or doc.get("caller_to"),
        "contact_name": doc.get("contact_name"),
        "call_sid": doc.get("call_sid"),
        "recording_url": doc.get("recording_url"),
        "recording_sid": doc.get("recording_sid"),
        "direction": doc.get("direction", "inbound"),
        "language": doc.get("language", "en-IN"),
        "status": doc.get("status", "completed"),
        "is_archived": doc.get("is_archived", False),
        "is_pinned": doc.get("is_pinned", False),
        "started_at": doc.get("started_at"),
        "ended_at": doc.get("ended_at"),
        "ringing_started_at": doc.get("ringing_started_at"),
        "answered_at": doc.get("answered_at"),
        "failure_reason": doc.get("failure_reason"),
        "duration_seconds": doc.get("duration_seconds", 0),
        "recording_duration": doc.get("recording_duration", 0),
        "turn_count": doc.get("turn_count", 0),
        "title": doc.get("title", "New Chat"),
        "last_message": doc.get("last_message", ""),
        "message_count": doc.get("message_count", 0),
    }


def _source_type(doc: dict) -> str:
    """Return the source_type from the DB, falling back to inference if missing."""
    # An explicitly stored source_type is authoritative. Older Web Chat rows
    # use caller_phone="Unknown Number", so checking that marker first would
    # hide hundreds of real Web Chat records as "unverified".
    if doc.get("source_type"):
        return doc["source_type"]

    # Legacy records created before source_type was introduced.
    direction = doc.get("direction")
    if doc.get("call_sid") and direction in ("inbound", "outbound"):
        return "phone_call"
    if doc.get("caller_phone") == "Voice Chat":
        return "voice_chat"
    if direction in ("voice", "test-voice-chat", "voice_chat"):
        return "voice_chat"
    if direction in ("test-chat", "web_chat"):
        # Legacy internal My AI test chats were stored as test-chat with the
        # Super Admin marker before source_type was introduced.
        if doc.get("caller_phone") == "Super Admin":
            return "admin_copilot"
        if doc.get("caller_phone") in ("Unknown Number", "Unknown"):
            return "web_chat"
        return "web_chat"
    if doc.get("caller_phone") in ("Unknown Number", "Unknown"):
        return "unverified"
    return "unverified"

@router.get("")
async def list_conversations(
    company_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    is_archived: Optional[bool] = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10000, le=100000),
    user: dict = Depends(get_platform_admin),
):
    """List all conversations across all companies."""
    query = {}
    if company_id:
        query["company_id"] = company_id
    if status:
        query["status"] = status
    if is_archived is not None:
        if is_archived:
            query["is_archived"] = True
        else:
            query["$or"] = [{"is_archived": False}, {"is_archived": {"$exists": False}}]

    cursor = col_conversations().find(query).sort("started_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    ids = [str(doc["_id"]) for doc in docs]
    actual_counts = {}
    for offset in range(0, len(ids), 1000):
        async for row in col_messages().aggregate([
            {"$match": {"conversation_id": {"$in": ids[offset:offset + 1000]}}},
            {"$group": {"_id": "$conversation_id", "count": {"$sum": 1}}},
        ]):
            actual_counts[str(row["_id"])] = row["count"]

    convs = []
    for doc in docs:
        fmt = _fmt_conv(doc)
        fmt["source_type"] = _source_type(doc)
        fmt["actual_message_count"] = actual_counts.get(str(doc["_id"]), 0)
        
        # We rely on pre-cached values from the conversation document now.
        if "first_message_at" in doc:
            fmt["first_message_at"] = doc["first_message_at"]
        if "last_message_at" in doc:
            fmt["last_message_at"] = doc["last_message_at"]

        convs.append(fmt)
        
    return {"conversations": convs, "count": len(convs)}


@router.post("/{company_id}/{conv_id}/archive")
async def archive_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Mark a conversation as archived."""
    success = await conversation_service.archive_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}


@router.post("/{company_id}/{conv_id}/restore")
async def restore_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Restore a conversation from the archive."""
    success = await conversation_service.restore_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}


@router.delete("/{company_id}/{conv_id}")
async def delete_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Hard delete a conversation and its messages."""
    success = await conversation_service.delete_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}

@router.post("/{company_id}/{conv_id}/pin")
async def pin_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Pin a conversation."""
    success = await conversation_service.pin_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}

@router.post("/{company_id}/{conv_id}/unpin")
async def unpin_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Unpin a conversation."""
    success = await conversation_service.unpin_conversation(company_id, conv_id)
    if not success:
        raise NotFoundError("Conversation")
    return {"success": True}

from pydantic import BaseModel
class AdminBulkIdsRequest(BaseModel):
    conversations: list[dict] # {"company_id": str, "id": str}

class AdminConversationStatusRequest(BaseModel):
    status: str

@router.post("/{company_id}/{conv_id}/status")
async def update_conversation_status(
    company_id: str,
    conv_id: str,
    req: AdminConversationStatusRequest,
    user: dict = Depends(get_platform_admin),
):
    """Update an active conversation to an auditable terminal call status."""
    allowed = {
        "completed", "failed", "cancelled", "canceled", "busy", "no-answer", "hung-up"
    }
    status = req.status.strip().lower()
    if status not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported conversation status")
    if not ObjectId.is_valid(conv_id):
        raise HTTPException(status_code=400, detail="Invalid conversation id")
    result = await col_conversations().update_one(
        {"_id": ObjectId(conv_id), "company_id": company_id},
        {"$set": {"status": status}},
    )
    if result.matched_count == 0:
        raise NotFoundError("Conversation")
    return {"success": True, "status": status}

@router.post("/bulk-archive")
async def bulk_archive(
    req: AdminBulkIdsRequest,
    user: dict = Depends(get_platform_admin),
):
    """Archive multiple conversations across companies."""
    # group by company
    from collections import defaultdict
    grouped = defaultdict(list)
    for c in req.conversations:
        grouped[c["company_id"]].append(c["id"])
    count = 0
    for comp_id, ids in grouped.items():
        count += await conversation_service.bulk_archive_conversations(comp_id, ids)
    return {"success": True, "count": count}

@router.post("/bulk-delete")
async def bulk_delete(
    req: AdminBulkIdsRequest,
    user: dict = Depends(get_platform_admin),
):
    """Delete multiple conversations across companies."""
    from collections import defaultdict
    grouped = defaultdict(list)
    for c in req.conversations:
        grouped[c["company_id"]].append(c["id"])
    count = 0
    for comp_id, ids in grouped.items():
        count += await conversation_service.bulk_delete_conversations(comp_id, ids)
    return {"success": True, "count": count}


@router.get("/detail/{company_id}/{conv_id}")
async def get_admin_conversation(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    user: dict = Depends(get_platform_admin),
):
    """Load one conversation in the platform-wide admin view."""
    if not ObjectId.is_valid(conv_id):
        raise NotFoundError("Conversation")
    doc = await col_conversations().find_one({
        "_id": ObjectId(conv_id),
        "company_id": None if company_id == "None" else company_id,
    })
    if not doc:
        raise NotFoundError("Conversation")
    result = _fmt_conv(doc)
    result["source_type"] = _source_type(doc)
    result["actual_message_count"] = await col_messages().count_documents({
        "conversation_id": conv_id,
    })
    return result


@router.get("/{company_id}/{conv_id}/messages")
async def get_conversation_messages(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    user: dict = Depends(get_platform_admin),
):
    """Get transcript messages for a specific conversation (admin access, any company)."""
    from core.database import col_messages
    if not ObjectId.is_valid(conv_id) or not await col_conversations().find_one({
        "_id": ObjectId(conv_id),
        "company_id": None if company_id == "None" else company_id,
    }):
        raise NotFoundError("Conversation")
    cursor = col_messages().find(
        {"conversation_id": conv_id}
    ).sort("timestamp", 1)
    msgs = []
    async for doc in cursor:
        msgs.append({
            "id": str(doc["_id"]),
            "role": doc.get("role", "user"),
            "content": doc.get("text") or doc.get("content") or "",
            "text": doc.get("text") or doc.get("content") or "",
            "timestamp": doc.get("timestamp"),
            "sources": doc.get("sources", []),
        })
    return {"messages": msgs, "count": len(msgs)}

from fastapi.responses import StreamingResponse
import httpx
from fastapi import HTTPException

@router.get("/{company_id}/{conv_id}/recording-token")
async def get_recording_token(
    company_id: str = Path(...),
    conv_id: str = Path(...),
    user: dict = Depends(get_platform_admin),
):
    """Generate a short-lived scoped JWT for secure browser audio streaming."""
    from bson import ObjectId
    doc = await col_conversations().find_one({"_id": ObjectId(conv_id), "company_id": company_id})
    if not doc or not doc.get("recording_url"):
        raise HTTPException(status_code=404, detail="Recording not found")
        
    import jwt
    from datetime import datetime, timedelta, timezone
    from core.config import settings
    
    payload = {
        "sub": "recording",
        "company_id": str(company_id),
        "conv_id": str(conv_id),
        "url": doc["recording_url"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    token = jwt.encode(payload, settings.app_secret_key, algorithm="HS256")
    return {"token": token}

@public_router.get("/{company_id}/{conv_id}/recording")
async def proxy_recording(
    request: Request,
    company_id: str = Path(...),
    conv_id: str = Path(...),
):
    """Secure proxy for authenticated Exotel or Twilio recording URLs."""
    token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
        
    try:
        payload = jwt.decode(token, settings.app_secret_key, algorithms=["HS256"])
        if payload.get("sub") != "recording":
            raise ValueError("Invalid token subject")
        # Tenant & Conversation Scoping Validation
        if payload.get("company_id") and str(payload.get("company_id")) != str(company_id):
            raise HTTPException(status_code=403, detail="Unauthorized: Token not valid for this tenant")
        if payload.get("conv_id") and str(payload.get("conv_id")) != str(conv_id):
            raise HTTPException(status_code=403, detail="Unauthorized: Token not valid for this conversation")
        url = payload["url"]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired recording token")

    parsed_url = urlparse(url)
    hostname = (parsed_url.hostname or "").lower().rstrip(".")
    configured_host = settings.exotel_subdomain.lower().split(":", 1)[0].rstrip(".")
    is_twilio = hostname == "api.twilio.com" or hostname.endswith(".twilio.com")
    allowed_host = is_twilio or hostname == configured_host or hostname.endswith(".exotel.com")
    if parsed_url.scheme != "https" or not hostname or not allowed_host:
        raise HTTPException(status_code=400, detail="Recording URL must be an approved HTTPS provider URL")
    try:
        for address in socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM):
            ip = ipaddress.ip_address(address[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise HTTPException(status_code=400, detail="Recording URL resolves to a private network")
    except HTTPException:
        raise
    except (socket.gaierror, ValueError, OSError):
        raise HTTPException(status_code=400, detail="Recording host could not be resolved")

    recording_auths = []
    if is_twilio:
        recording_auth = (settings.twilio_account_sid, settings.twilio_auth_token)
        if not all(recording_auth):
            raise HTTPException(status_code=503, detail="Twilio credentials are not configured")
        recording_auths.append(recording_auth)
        if not url.endswith(".mp3"):
            url = url + ".mp3"
    else:
        # Recordings are owned by the channel's Exotel account. The global
        # fallback credentials can belong to another tenant/account, which
        # causes Exotel to return 401 even when the call itself succeeded.
        recording_auth = (settings.exotel_api_key, settings.exotel_api_token)
        if all(recording_auth):
            recording_auths.append(recording_auth)
        try:
            conv = await col_conversations().find_one(
                {"_id": ObjectId(conv_id), "company_id": company_id},
                {"channel_id": 1},
            )
            channel_ref = str((conv or {}).get("channel_id") or "")
            if channel_ref:
                channel = await col_channels().find_one({"_id": ObjectId(channel_ref)})
                channel_credentials = (channel or {}).get("credentials") or {}
                from core.security import decrypt_secret
                channel_key = decrypt_secret(channel_credentials.get("api_key_encrypted", ""))
                channel_token = decrypt_secret(channel_credentials.get("api_token_encrypted", ""))
                if channel_key and channel_token:
                    recording_auths.insert(0, (channel_key, channel_token))
            # Older records can have a missing channel_id. Try configured
            # Exotel accounts in the same company before declaring the media
            # unavailable; this keeps historical recordings playable.
            company_channels = await col_channels().find(
                {"company_id": company_id, "type": {"$in": ["exotel", "exotel_voice"]}},
                {"credentials": 1},
            ).to_list(length=20)
            from core.security import decrypt_secret
            for candidate in company_channels:
                candidate_credentials = candidate.get("credentials") or {}
                candidate_auth = (
                    decrypt_secret(candidate_credentials.get("api_key_encrypted", "")),
                    decrypt_secret(candidate_credentials.get("api_token_encrypted", "")),
                )
                if all(candidate_auth) and candidate_auth not in recording_auths:
                    recording_auths.append(candidate_auth)
        except (TypeError, ValueError):
            pass
        if not recording_auths:
            raise HTTPException(status_code=503, detail="Exotel credentials are not configured")
    
    req_headers = {}
    range_header = request.headers.get("range")
    if range_header:
        req_headers["Range"] = range_header

    upstream_response = None
    client = None
    for recording_auth in recording_auths:
        candidate_client = httpx.AsyncClient(auth=recording_auth, follow_redirects=False, timeout=30.0)
        req = candidate_client.build_request("GET", url, headers=req_headers)
        candidate_response = await candidate_client.send(req, stream=True)
        if candidate_response.status_code in (200, 206):
            client = candidate_client
            upstream_response = candidate_response
            break
        await candidate_response.aclose()
        await candidate_client.aclose()
    if upstream_response is None or client is None:
        raise HTTPException(status_code=502, detail="Upstream recording unavailable")
        
    async def stream():
        try:
            async for chunk in upstream_response.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await upstream_response.aclose()
            await client.aclose()
            
    headers = {
        "Content-Type": upstream_response.headers.get("Content-Type", "audio/mpeg"),
        "Accept-Ranges": "bytes"
    }
    if "Content-Length" in upstream_response.headers:
        headers["Content-Length"] = upstream_response.headers["Content-Length"]
    if "Content-Range" in upstream_response.headers:
        headers["Content-Range"] = upstream_response.headers["Content-Range"]
        
    return StreamingResponse(
        stream(), 
        status_code=upstream_response.status_code,
        headers=headers
    )

@router.get("/by-call-sid/{call_sid}")
async def get_conversation_by_call_sid(
    call_sid: str,
    user: dict = Depends(get_platform_admin),
):
    from core.database import col_conversations, col_messages
    doc = await col_conversations().find_one({"call_sid": call_sid})
    if not doc:
        raise NotFoundError("Conversation not found")
        
    fmt = _fmt_conv(doc)
    
    cursor = col_messages().find({"conversation_id": str(doc["_id"])}).sort("timestamp", 1)
    msgs = []
    async for m in cursor:
        msgs.append({
            "id": str(m["_id"]),
            "role": m.get("role", "user"),
            "content": m.get("text") or m.get("content") or "",
            "created_at": m.get("timestamp")
        })
        
    fmt["messages"] = msgs
    return fmt

@router.post("/by-call-sid/{call_sid}/end")
async def end_call_by_sid(
    call_sid: str,
    user: dict = Depends(get_platform_admin),
):
    from core.database import col_conversations
    doc = await col_conversations().find_one({"call_sid": call_sid})
    if not doc:
        raise NotFoundError("Conversation not found")
        
    import httpx
    from core.config import settings
    from services.conversation_service import end_conversation
    
    if call_sid.startswith("CA"):
        if settings.twilio_account_sid and settings.twilio_auth_token:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Calls/{call_sid}.json"
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        url, 
                        data={"Status": "completed"}, 
                        auth=(settings.twilio_account_sid, settings.twilio_auth_token)
                    )
            except Exception:
                pass
    else:
        exotel_sid = settings.exotel_account_sid
        exotel_key = settings.exotel_api_key
        exotel_token = settings.exotel_api_token
        exotel_subdomain = settings.exotel_subdomain
        if all((exotel_sid, exotel_key, exotel_token)):
            url = f"https://{exotel_subdomain}/v1/Accounts/{exotel_sid}/Calls/{call_sid}.json"
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        url, 
                        data={"Status": "completed"}, 
                        auth=(exotel_key, exotel_token)
                    )
            except Exception:
                pass

    # Always ensure conversation is finalized in the database
    await end_conversation(call_sid=call_sid, status="completed")
    await col_conversations().update_one(
        {"call_sid": call_sid}, 
        {"$set": {"status": "completed", "failure_reason": "Ended by admin"}}
    )
    return {"success": True}

@router.post("/{company_id}/{conversation_id}/force-fail")
async def force_fail_conversation(company_id: str, conversation_id: str, user: dict = Depends(get_platform_admin)):
    from core.database import col_conversations
    from bson import ObjectId
    res = await col_conversations().update_one(
        {"_id": ObjectId(conversation_id), "company_id": company_id},
        {"$set": {"status": "failed"}}
    )
    if res.matched_count == 0:
        raise NotFoundError("Conversation")
    return {"success": True, "message": "Marked as failed"}



@router.get("/caller-profile/{phone}")
@public_router.get("/caller-profile/{phone}")
async def get_caller_crm_profile(
    phone: str,
    company_id: Optional[str] = Query(None),
):
    from services.caller_intelligence_service import get_caller_profile
    cid = company_id or "6adde16e093109b716737af3"
    return await get_caller_profile(cid, phone)


@router.post("/caller-profile/{phone}/save")
@public_router.post("/caller-profile/{phone}/save")
async def save_caller_crm_contact(
    phone: str,
    request: Request,
    company_id: Optional[str] = Query(None),
):
    from services.caller_intelligence_service import save_caller_contact
    cid = company_id or "6adde16e093109b716737af3"
    data = await request.json()
    name = str(data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    email = data.get("email")
    notes = data.get("notes")
    return await save_caller_contact(cid, phone, name, email, notes)
