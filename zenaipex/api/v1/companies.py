"""
Zenaipex AI — Companies API router.

GET    /api/v1/companies                   List user's companies
POST   /api/v1/companies                   Create a new company
GET    /api/v1/companies/{id}              Get company details
PATCH  /api/v1/companies/{id}             Update company
GET    /api/v1/companies/{id}/subscription Get subscription + limits
GET    /api/v1/companies/{id}/team        List team members
POST   /api/v1/companies/{id}/team        Invite team member
PATCH  /api/v1/companies/{id}/team/{uid}  Update member role
DELETE /api/v1/companies/{id}/team/{uid}  Remove team member
"""
from fastapi import APIRouter, Depends, Path, UploadFile, File, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
import os
import logging
import asyncio
import csv
import io

logger = logging.getLogger(__name__)

from core.dependencies import (
    get_verified_user, get_current_user, get_auth_context, require_admin, require_owner,
    require_onboarding_admin, get_unverified_auth_context, AuthContext,
)
from core.database import (
    col_companies, col_subscriptions, col_team_members, col_agents,
    col_documents, col_knowledge_bases, col_conversations, col_messages,
    col_channels, col_usage_records, col_scheduled_calls, col_timing_metrics,
    col_custom_voices, col_activity_logs, col_background_jobs,
    col_llm_requests, col_platform_settings,
)
from core.exceptions import NotFoundError
from services.storage_service import save_upload, delete_file
from models.company import CompanyCreate, CompanyUpdate, TeamMemberCreate
from services import tenant_service, knowledge_service
from services.usage_service import get_usage_summary, get_usage_record
import re
from slugify import slugify

router = APIRouter(prefix="/companies", tags=["Companies"])

class GreetingSuggestionRequest(BaseModel):
    direction: str = "inbound"
    language: str = "en-IN"


class CompanyDeletionRequest(BaseModel):
    """Explicit confirmation required for irreversible tenant deletion."""
    confirmation: str


def _fmt_company(doc: dict) -> dict:
    public_settings = dict(doc.get("settings", {}) or {})
    # Logo bytes are served by the dedicated logo endpoint. Never put BSON
    # Binary data into the JSON company response.
    public_settings.pop("logo_data", None)
    public_settings.pop("logo_content_type", None)
    public_settings.pop("logo_filename", None)
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "slug": doc["slug"],
        "industry": doc.get("industry"),
        "country": doc.get("country", "IN"),
        "timezone": doc.get("timezone", "Asia/Kolkata"),
        "plan": doc.get("plan", "free_trial"),
        "is_active": doc.get("is_active", True),
        "user_role": doc.get("user_role"),
        "settings": public_settings,
        "onboarding_completed": public_settings.get("onboarding_completed", True),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


_EXPORT_SECRET_FIELDS = {
    "password_hash", "two_factor_secret", "logo_data", "api_key", "api_token",
    "auth_token", "access_token", "refresh_token", "client_secret", "webhook_secret",
}


def _export_safe(value):
    """Convert Mongo values to JSON while excluding credential material."""
    if isinstance(value, dict):
        return {
            str(key): _export_safe(item)
            for key, item in value.items()
            if str(key).lower() not in _EXPORT_SECRET_FIELDS
        }
    if isinstance(value, list):
        return [_export_safe(item) for item in value]
    if isinstance(value, (datetime, ObjectId)):
        return str(value)
    return value


@router.get("", summary="List my companies")
async def list_companies(user: dict = Depends(get_current_user)):
    """List all companies the authenticated user belongs to."""
    user_id = str(user["_id"])
    companies = await tenant_service.get_user_companies(user_id)
    return {"companies": [_fmt_company(c) for c in companies]}


@router.post("", status_code=201, summary="Create a new company")
async def create_company(
    body: CompanyCreate,
    user: dict = Depends(get_verified_user),
):
    """
    Create a new company. The caller becomes the Owner.
    A Free Trial subscription is auto-created.
    """
    from services.auth_service import register_user
    # Use the sub-flow from auth_service that creates company + sub + membership
    user_id = str(user["_id"])
    slug = body.slug or slugify(body.name, max_length=60)

    # Ensure slug uniqueness
    now = datetime.now(timezone.utc)
    if await col_companies().find_one({"slug": slug}):
        slug = f"{slug}-{int(now.timestamp())}"

    from models.subscription import PLAN_LIMITS
    company_doc = {
        "name": body.name,
        "slug": slug,
        "industry": body.industry,
        "country": body.country,
        "timezone": body.timezone,
        "plan": "free_trial",
        "is_active": True,
        "settings": {"onboarding_completed": False},
        "created_at": now,
        "updated_at": now,
    }
    result = await col_companies().insert_one(company_doc)
    company_id = str(result.inserted_id)

    # Create owner membership
    await col_team_members().insert_one({
        "company_id": company_id,
        "user_id": user_id,
        "role": "owner",
        "joined_at": now,
    })

    # Create subscription
    from core.config import settings as cfg
    from datetime import timedelta
    trial_end = now + timedelta(days=cfg.free_trial_days)
    await col_subscriptions().insert_one({
        "company_id": company_id,
        "plan": "free_trial",
        "status": "trial",
        "trial_starts_at": now,
        "trial_ends_at": trial_end,
        "limits": PLAN_LIMITS["free_trial"],
        "billing_cycle": "monthly",
        "created_at": now,
        "updated_at": now,
    })

    company_doc["_id"] = result.inserted_id
    return _fmt_company(company_doc)


@router.get("/{company_id}", summary="Get company details")
async def get_company(
    company_id: str = Path(...),
    ctx: AuthContext = Depends(get_unverified_auth_context),
):
    """Get full company details. Must be a member."""
    return _fmt_company(ctx.company)


@router.post("/{company_id}/autofill-from-kb", summary="Auto-fill company profile from KB")
async def autofill_company_profile(
    company_id: str = Path(...),
    ctx: AuthContext = Depends(require_owner),
):
    """Extract business info from the default knowledge base and return JSON."""
    from services.knowledge_service import list_documents, get_document_chunks, get_or_create_default_kb
    from ai.llm import AgentLLMClient
    import json
    
    # 1. Get default KB
    kb = await get_or_create_default_kb(company_id, ctx.company.get("name", "Company"))
    
    # 2. Get all documents
    docs = await list_documents(company_id, kb_id=str(kb["_id"]), skip=0, limit=20)
    
    if not docs:
        raise HTTPException(status_code=400, detail="Knowledge base is empty. Please upload documents or crawl a website first.")
        
    # 3. Get representative chunks from all docs
    all_text = []
    for doc in docs:
        chunks = await get_document_chunks(company_id, str(kb["_id"]), str(doc["_id"]))
        # Take up to 50 chunks per document to ensure deep coverage of contact sections
        for c in chunks[:50]:
            all_text.append(c["text"])
            
        if len(all_text) > 300:
            break
            
    if not all_text:
        raise HTTPException(status_code=400, detail="No text found in knowledge base.")
        
    context_text = "\n\n".join(all_text)
    
    query = f'''You are a data extractor. Based on the provided context, extract the following company information into a strict JSON object.
Knowledge Base Text:
{context_text}

Fields:
- legal_name (string)
- industry (string)
- business_email (string)
- phone (string)
- website (string)
- address (string)
- business_description (string)
- business_hours (object with monday, tuesday, wednesday, thursday, friday, saturday, sunday; each having active(bool), start(string), end(string))

IMPORTANT: For email, phone, website, and address, if you cannot find them for the specific product, you MUST extract the contact details of the parent company (e.g. ZeniaPex) if available in the text.
Only output valid JSON without any markdown formatting like ```json. If you still cannot find a field, leave it null.'''

    dummy_agent = {
        "_id": "dummy",
        "company_id": company_id,
        "name": "Dummy",
        "system_prompt": "You are a helpful assistant.",
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.1,
    }
    
    async with await AgentLLMClient.create(dummy_agent) as llm:
        resp, usage = await llm.generate(
            user_message=query,
            conversation_history=[],
            context_docs=[],
            language="en-IN",
        )
        
    response_text = resp or "{}"
    # Strip markdown block if it exists
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]
        
    response_text = response_text.strip()
    
    try:
        data = json.loads(response_text)
        return data
    except Exception as e:
        logger.error(f"Failed to parse LLM JSON: {e}, Response: {response_text}")
        raise HTTPException(status_code=500, detail="Failed to extract data in a valid format.")


@router.patch("/{company_id}", summary="Update company")
async def update_company(
    body: CompanyUpdate,
    company_id: str = Path(...),
    ctx: AuthContext = Depends(require_onboarding_admin),
):
    """Update company settings. Requires admin role."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    
    is_verified = ctx.user.get("is_verified", False)
    
    if not is_verified:
        allowed_top_level = {"name", "industry", "country", "timezone", "settings"}
        updates = {k: v for k, v in updates.items() if k in allowed_top_level}
        
        if "settings" in updates and isinstance(updates["settings"], dict):
            allowed_settings = {
                "business_email", "phone", "website", "address", "legal_name",
                "default_agent", "default_language", "default_voice",
                "business_hours", "greeting_message", "inbound_greeting", "outbound_greeting",
                "business_description", "customer_policies"
            }
            # Merge safely with existing DB settings to avoid overwriting sensitive fields
            company = await tenant_service.get_company(company_id)
            db_settings = company.get("settings", {}) if company else {}
            
            for k in allowed_settings:
                if k in updates["settings"]:
                    db_settings[k] = updates["settings"][k]
                    
            if "business_hours" in db_settings and isinstance(db_settings["business_hours"], str):
                import json
                try:
                    bh = json.loads(db_settings["business_hours"])
                    # Normalize to 7 days
                    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                    for day in days:
                        if day not in bh:
                            bh[day] = {"isOpen": False, "open": "09:00", "close": "17:00"}
                    db_settings["business_hours"] = json.dumps(bh)
                except Exception:
                    pass
            
            updates["settings"] = db_settings

    await tenant_service.update_company(company_id, updates)
    company = await tenant_service.get_company(company_id)
    if not company:
        raise NotFoundError("Company")
    asyncio.create_task(knowledge_service.sync_workspace_profile_to_knowledge(company_id, company))
    return _fmt_company(company)


@router.post("/{company_id}/greeting-suggestions", summary="Generate a concise agent greeting")
async def generate_greeting_suggestion(
    body: GreetingSuggestionRequest,
    company_id: str = Path(...),
    ctx: AuthContext = Depends(require_onboarding_admin),
):
    """Generate one concise editable greeting using the selected business profile."""
    company = await tenant_service.get_company(company_id)
    if not company:
        raise NotFoundError("Company")
    direction = "outbound" if body.direction.lower() == "outbound" else "inbound"
    from ai.llm import AgentLLMClient
    agent = {
        "_id": "greeting-generator",
        "company_id": company_id,
        "name": "Greeting generator",
        "system_prompt": "Write only a natural, concise customer call greeting. No markdown, quotes, labels, emoji, or explanation.",
        "_runtime_surface": "text_chat",
        "default_language": body.language,
    }
    prompt = (
        f"Create one {'outbound sales/callback' if direction == 'outbound' else 'inbound customer support'} greeting for "
        f"{company.get('name', 'our business')}. Language: {body.language}. "
        "Keep it under 22 words. Introduce the business and ask how you can help."
    )
    try:
        async with await AgentLLMClient.create(agent, request_id="GREETING-GENERATOR") as llm:
            text, _ = await llm.generate(prompt, language=body.language, max_tokens=70)
        greeting = (text or "").strip().replace("\n", " ")
    except Exception:
        greeting = "Hello, thank you for calling. How may I help you today?" if direction == "inbound" else f"Hello, this is {company.get('name', 'our team')}. Is this a good time to speak?"
    return {"greeting": greeting[:280], "direction": direction}

from fastapi.responses import FileResponse, StreamingResponse, Response
from bson.binary import Binary
from io import BytesIO
import os

@router.get("/{company_id}/logo", summary="Get company logo")
async def get_company_logo(company_id: str = Path(...)):
    """Serve the company logo."""
    company = await tenant_service.get_company(company_id)
    if not company:
        raise NotFoundError("Company")
        
    company_settings = company.get("settings", {})
    logo_data = company_settings.get("logo_data")
    if logo_data:
        return StreamingResponse(
            BytesIO(bytes(logo_data)),
            media_type=company_settings.get("logo_content_type") or "image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    logo_path = company_settings.get("logo_url")
    if not logo_path or not os.path.exists(logo_path):
        raise HTTPException(status_code=404, detail="Logo not found")
        
    return FileResponse(logo_path, headers={"Cache-Control": "public, max-age=86400"})


@router.post("/{company_id}/logo", summary="Upload company logo")
async def upload_company_logo(
    company_id: str = Path(...),
    file: UploadFile = File(...),
    ctx: AuthContext = Depends(require_admin),
):
    """Upload a company logo."""
    MAX_SIZE = 2 * 1024 * 1024  # 2MB
    
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    
    if size > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Logo too large. Maximum size is 2MB.")
        
    content_type = file.content_type or ""
    content = await file.read(MAX_SIZE + 1)
    from services.upload_validation import validate_image_upload
    validate_image_upload(content, content_type, max_bytes=MAX_SIZE)

    # Save new file
    filename = file.filename or "logo.png"
    storage_path = await save_upload(company_id=company_id, filename=filename, content=content)
    
    # Delete old logo if exists
    company = await tenant_service.get_company(company_id)
    old_logo = company.get("settings", {}).get("logo_url")
    if old_logo:
        await delete_file(old_logo)

    # Update DB
    db_settings = company.get("settings", {})
    db_settings["logo_url"] = f"mongo://company/{company_id}/logo"
    db_settings["logo_data"] = Binary(content)
    db_settings["logo_content_type"] = content_type
    db_settings["logo_filename"] = filename
    db_settings["logo_size"] = size
    db_settings["logo_uploaded_at"] = datetime.now(timezone.utc).isoformat()
    
    await col_companies().update_one(
        {"_id": ObjectId(company_id)},
        {"$set": {"settings": db_settings, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "logo_url": storage_path}


@router.delete("/{company_id}/logo", summary="Remove company logo")
async def remove_company_logo(
    company_id: str = Path(...),
    ctx: AuthContext = Depends(require_admin),
):
    """Remove company logo."""
    company = await tenant_service.get_company(company_id)
    old_logo = company.get("settings", {}).get("logo_url")
    
    if old_logo:
        await delete_file(old_logo)
        db_settings = company.get("settings", {})
        db_settings["logo_url"] = None
        db_settings["logo_data"] = None
        db_settings["logo_content_type"] = None
        db_settings["logo_filename"] = None
        
        await col_companies().update_one(
            {"_id": ObjectId(company_id)},
            {"$set": {"settings": db_settings, "updated_at": datetime.now(timezone.utc)}}
        )
        
    return {"success": True}

@router.get("/{company_id}/overview", summary="Get dashboard overview metrics")
async def get_overview(
    company_id: str = Path(...),
    ctx: AuthContext = Depends(get_unverified_auth_context),
):
    """Aggregate dashboard metrics."""
    usage = await get_usage_summary(company_id)
    
    return {
        "metrics": {
            "total_agents": usage.get("agents_used", 0),
            "active_agents": usage.get("active_agents", 0),
            "total_conversations": usage.get("total_conversations", 0),
            "total_documents": usage.get("kb_docs_used", 0),
            "call_minutes_used": usage.get("call_minutes_used", 0) if usage else 0,
        }
    }


@router.get("/{company_id}/analytics", summary="Get detailed analytics")
async def get_analytics(
    company_id: str = Path(...),
    range: str = "30d",
    ctx: AuthContext = Depends(get_unverified_auth_context),
):
    """Get detailed time-series and provider analytics for the dashboard."""
    from services.usage_service import get_detailed_analytics
    
    # Parse range (e.g. 7d, 30d, 90d)
    days = 30
    if range and range.endswith("d"):
        try:
            days = int(range[:-1])
        except ValueError:
            pass
            
    analytics_data = await get_detailed_analytics(company_id, days=days)
    return analytics_data



@router.get("/{company_id}/subscription", summary="Get subscription and usage")
async def get_subscription(
    company_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """Get subscription plan, limits, and current month's usage."""
    sub = await tenant_service.get_subscription(company_id)
    usage = await get_usage_summary(company_id)
    return {
        "subscription": {
            "plan": sub.get("plan", "free_trial") if sub else "free_trial",
            "status": sub.get("status", "trial") if sub else "trial",
            "trial_ends_at": sub.get("trial_ends_at") if sub else None,
            "limits": sub.get("limits", {}) if sub else {},
        },
        "usage": usage,
    }


def _calculate_provider_cost_inr(rows: list[dict], pricing_conf: dict) -> Optional[float]:
    """Calculate recorded LLM provider cost using the configured price book."""
    if not pricing_conf:
        return None
    exchange_rate = float(pricing_conf.get("usd_to_inr_rate", 86.50) or 86.50)
    total = 0.0
    priced_rows = 0
    for row in rows:
        provider = str(row.get("provider", "")).strip().lower()
        model = row.get("model")
        provider_rates = pricing_conf.get(provider) or pricing_conf.get("default")
        if not isinstance(provider_rates, dict):
            continue
        rates = provider_rates.get(model) or provider_rates.get("default")
        if not isinstance(rates, dict):
            continue
        input_tokens = int(row.get("input_tokens", 0) or 0)
        output_tokens = int(row.get("output_tokens", 0) or 0)
        total += ((input_tokens / 1_000_000) * float(rates.get("input_1m", 0) or 0))
        total += ((output_tokens / 1_000_000) * float(rates.get("output_1m", 0) or 0))
        priced_rows += 1
    return total * exchange_rate if priced_rows else None


@router.get("/{company_id}/billing/invoice", summary="Get a transparent billing invoice preview")
async def get_billing_invoice(
    company_id: str = Path(...),
    month: Optional[str] = None,
    ctx: AuthContext = Depends(get_auth_context),
):
    """Return a month-scoped invoice preview without inventing prices."""
    billing_month = month or datetime.now(timezone.utc).strftime("%Y-%m")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", billing_month):
        raise HTTPException(status_code=422, detail="month must use YYYY-MM format")

    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    subscription = await tenant_service.get_subscription(company_id)
    usage = await get_usage_record(company_id, billing_month) or {}
    plan = (subscription or {}).get("plan", "free_trial")
    configured_amount = (subscription or {}).get("monthly_price_inr")

    month_start = datetime.strptime(billing_month, "%Y-%m").replace(tzinfo=timezone.utc)
    next_month = month_start.replace(
        year=month_start.year + (1 if month_start.month == 12 else 0),
        month=1 if month_start.month == 12 else month_start.month + 1,
    )
    llm_rows = await col_llm_requests().find({
        "company_id": company_id,
        "timestamp": {"$gte": month_start, "$lt": next_month},
    }, {"provider": 1, "model": 1, "input_tokens": 1, "output_tokens": 1}).to_list(length=100_000)
    pricing_doc = await col_platform_settings().find_one({"type": "global"}) or {}
    provider_cost_inr = _calculate_provider_cost_inr(llm_rows, pricing_doc.get("pricing") or {})

    line_items = [
        {"name": "Voice minutes", "quantity": round(float(usage.get("call_minutes_used", 0) or 0), 2), "unit": "minute"},
        {"name": "AI requests", "quantity": int(usage.get("llm_api_calls", 0) or 0), "unit": "request"},
        {"name": "STT API calls", "quantity": int(usage.get("stt_api_calls", 0) or 0), "unit": "request"},
        {"name": "TTS API calls", "quantity": int(usage.get("tts_api_calls", 0) or 0), "unit": "request"},
    ]
    if provider_cost_inr is not None:
        line_items.append({"name": "Provider usage cost", "quantity": round(provider_cost_inr, 4), "unit": "INR"})
    base_amount = float(configured_amount) if configured_amount is not None else None
    amount_due = (base_amount + provider_cost_inr) if base_amount is not None and provider_cost_inr is not None else base_amount
    if amount_due is None and provider_cost_inr is not None:
        amount_due = provider_cost_inr
    return {
        "invoice_id": f"{company_id[:8]}-{billing_month}",
        "status": "preview",
        "billing_period": billing_month,
        "company": {"id": company_id, "name": (company or {}).get("name", "")},
        "plan": plan,
        "line_items": line_items,
        "amount_due_inr": round(amount_due, 4) if amount_due is not None else None,
        "amount_status": "configured" if base_amount is not None else ("usage_only" if provider_cost_inr is not None else "not_configured"),
        "provider_cost_inr": round(provider_cost_inr, 4) if provider_cost_inr is not None else None,
        "message": "Amount combines configured subscription price and recorded provider usage cost when pricing is configured.",
    }


def _build_usage_csv(company_name: str, company_id: str, month: str, usage: dict) -> str:
    """Build a safe, deterministic monthly usage report without secrets."""
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["company_id", "company_name", "month", "metric", "value", "unit"])
    metrics = (
        ("voice_minutes", round(float(usage.get("call_minutes_used", 0) or 0), 2), "minutes"),
        ("calls", int(usage.get("call_count", 0) or 0), "calls"),
        ("ai_requests", int(usage.get("llm_api_calls", 0) or 0), "requests"),
        ("stt_api_calls", int(usage.get("stt_api_calls", 0) or 0), "requests"),
        ("tts_api_calls", int(usage.get("tts_api_calls", 0) or 0), "requests"),
        ("rag_queries", int(usage.get("rag_queries", 0) or 0), "queries"),
        ("total_tokens", int(usage.get("total_tokens", 0) or 0), "tokens"),
    )
    for metric, value, unit in metrics:
        writer.writerow([company_id, company_name, month, metric, value, unit])
    return output.getvalue()


def _build_usage_pdf(company_name: str, company_id: str, month: str, usage: dict) -> bytes:
    """Build a compact audit-friendly usage PDF without raw secrets/logs."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    buffer = io.BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("ZeniaOne Monthly Usage Report", styles["Title"]),
        Paragraph(f"Company: {company_name} ({company_id})<br/>Billing month: {month}", styles["Normal"]),
        Spacer(1, 8 * mm),
    ]
    rows = [["Metric", "Value", "Unit"]]
    csv_lines = _build_usage_csv(company_name, company_id, month, usage).splitlines()[1:]
    for line in csv_lines:
        _company_id, _company_name, _month, metric, value, unit = next(csv.reader([line]))
        rows.append([metric.replace("_", " ").title(), value, unit])
    table = Table(rows, colWidths=[80 * mm, 35 * mm, 35 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0b5d42")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5d1")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f5faf7")),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(table)
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("This report contains recorded usage quantities only. Credentials, API keys and raw conversation logs are excluded.", styles["Normal"]))
    document.build(story)
    return buffer.getvalue()


@router.get("/{company_id}/billing/usage.csv", summary="Download monthly usage CSV")
async def download_usage_csv(
    company_id: str = Path(...),
    month: Optional[str] = None,
    ctx: AuthContext = Depends(require_admin),
):
    """Download owner/admin-scoped billing usage without credentials or raw logs."""
    billing_month = month or datetime.now(timezone.utc).strftime("%Y-%m")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", billing_month):
        raise HTTPException(status_code=422, detail="month must use YYYY-MM format")
    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    usage = await get_usage_record(company_id, billing_month) or {}
    csv_content = _build_usage_csv((company or {}).get("name", "Company"), company_id, billing_month, usage)
    filename = f"zeniaone-usage-{company_id[:8]}-{billing_month}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{company_id}/billing/usage.pdf", summary="Download monthly usage PDF")
async def download_usage_pdf(
    company_id: str = Path(...),
    month: Optional[str] = None,
    ctx: AuthContext = Depends(require_admin),
):
    """Download owner/admin-scoped billing usage as a PDF report."""
    billing_month = month or datetime.now(timezone.utc).strftime("%Y-%m")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", billing_month):
        raise HTTPException(status_code=422, detail="month must use YYYY-MM format")
    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    usage = await get_usage_record(company_id, billing_month) or {}
    pdf_content = _build_usage_pdf((company or {}).get("name", "Company"), company_id, billing_month, usage)
    filename = f"zeniaone-usage-{company_id[:8]}-{billing_month}.pdf"
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{company_id}/data-export", summary="Export tenant data safely")
async def export_company_data(
    company_id: str = Path(...),
    ctx: AuthContext = Depends(require_owner),
):
    """Export tenant-owned records for privacy/access requests."""
    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    collections = {
        "team_members": col_team_members(),
        "agents": col_agents(),
        "documents": col_documents(),
        "knowledge_bases": col_knowledge_bases(),
        "conversations": col_conversations(),
        "messages": col_messages(),
        "channels": col_channels(),
        "usage_records": col_usage_records(),
    }


@router.delete("/{company_id}/data", summary="Permanently delete tenant data")
async def delete_company_data(
    body: CompanyDeletionRequest,
    company_id: str = Path(...),
    ctx: AuthContext = Depends(require_owner),
):
    """Delete a tenant only after an owner explicitly confirms the exact ID."""
    expected_confirmation = f"DELETE {company_id}"
    if body.confirmation.strip() != expected_confirmation:
        raise HTTPException(
            status_code=422,
            detail=f"Type '{expected_confirmation}' to confirm permanent deletion",
        )
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=422, detail="company_id must be a valid ObjectId")
    if company_id == "6a990b403e9b17bef89acf87":
        raise HTTPException(status_code=403, detail="The internal platform company cannot be deleted")

    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Keep this list explicit so a newly-added collection cannot be deleted by
    # accident without a deliberate code review.
    tenant_collections = (
        col_team_members(), col_subscriptions(), col_agents(),
        col_knowledge_bases(), col_documents(), col_channels(),
        col_messages(), col_conversations(), col_usage_records(),
        col_scheduled_calls(), col_timing_metrics(), col_custom_voices(),
        col_background_jobs(),
    )
    filter_query = {"company_id": company_id}
    deleted_counts = {}
    for collection in tenant_collections:
        result = await collection.delete_many(filter_query)
        deleted_counts[collection.name] = result.deleted_count

    await col_companies().delete_one({"_id": ObjectId(company_id)})
    await col_activity_logs().insert_one({
        "action": "company_data_deleted",
        "company_id": company_id,
        "actor_user_id": ctx.user_id,
        "details": "Tenant data permanently deleted after owner confirmation.",
        "created_at": datetime.now(timezone.utc),
    })
    return {
        "success": True,
        "company_id": company_id,
        "deleted_counts": deleted_counts,
        "message": "Company and tenant-owned data permanently deleted.",
    }
    exported = {}
    for name, collection in collections.items():
        rows = await collection.find({"company_id": company_id}).to_list(length=20_000)
        exported[name] = [_export_safe(row) for row in rows]

    return {
        "export_type": "tenant_data_export",
        "exported_at": datetime.now(timezone.utc),
        "company": _export_safe(company or {}),
        "data": exported,
        "redacted_fields": sorted(_EXPORT_SECRET_FIELDS),
    }


# ── Team Management ───────────────────────────────────────────────────────────

@router.get("/{company_id}/team", summary="List team members")
async def list_team(
    company_id: str = Path(...),
    ctx: AuthContext = Depends(get_auth_context),
):
    """List all team members with their roles."""
    members = await tenant_service.get_team_members(company_id)
    return {"members": members}


@router.post("/{company_id}/team", status_code=201, summary="Invite team member")
async def invite_member(
    body: TeamMemberCreate,
    company_id: str = Path(...),
    ctx: AuthContext = Depends(require_admin),
):
    """Invite a registered user to the company. Admin+ only."""
    result = await tenant_service.invite_team_member(
        company_id=company_id,
        inviter_role=ctx.role,
        email=body.email,
        role=body.role.value,
    )
    return result


@router.patch("/{company_id}/team/{user_id}", summary="Update team member role")
async def update_member_role(
    company_id: str = Path(...),
    user_id: str = Path(...),
    role: str = "member",
    ctx: AuthContext = Depends(require_admin),
):
    """Change a team member's role. Admin+ only."""
    await tenant_service.update_member_role(
        company_id=company_id,
        target_user_id=user_id,
        new_role=role,
        requester_role=ctx.role,
    )
    return {"success": True, "user_id": user_id, "new_role": role}


@router.delete("/{company_id}/team/{user_id}", summary="Remove team member")
async def remove_member(
    company_id: str = Path(...),
    user_id: str = Path(...),
    ctx: AuthContext = Depends(require_admin),
):
    """Remove a team member. Admin+ only."""
    await tenant_service.remove_team_member(
        company_id=company_id,
        target_user_id=user_id,
        requester_role=ctx.role,
    )
    return {"success": True}


@router.patch("/{company_id}/onboarding", summary="Update company during onboarding")
async def update_company_onboarding(
    body: CompanyUpdate,
    company_id: str = Path(...),
    ctx: AuthContext = Depends(require_onboarding_admin),
):
    """
    Update company settings during onboarding ONLY.
    Does not require email verification.
    """
    # Restrict what can be updated during onboarding
    allowed_keys = {"industry", "country", "settings"}
    updates = {k: v for k, v in body.model_dump().items() if v is not None and k in allowed_keys}
    
    # If they are trying to update settings, ensure it's only onboarding_completed
    if "settings" in updates:
        updates["settings"] = {"onboarding_completed": updates["settings"].get("onboarding_completed", False)}
        
    if updates:
        await tenant_service.update_company(company_id, updates)
        
    company = await tenant_service.get_company(company_id)
    if not company:
        raise NotFoundError("Company")
    return _fmt_company(company)
