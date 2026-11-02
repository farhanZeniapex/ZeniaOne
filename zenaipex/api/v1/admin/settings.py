from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import os
from datetime import datetime, timezone
from fastapi.responses import FileResponse, StreamingResponse
from bson.binary import Binary
from io import BytesIO

from core.dependencies import get_platform_admin
from core.database import col_platform_settings, col_activity_logs
from services.storage_service import save_upload, delete_file

router = APIRouter(prefix="/settings", tags=["Admin - Settings"])
public_router = APIRouter(prefix="/settings", tags=["Admin - Settings Public"])

# ── Models ────────────────────────────────────────────────────────────────────

class PlatformSettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    default_language: Optional[str] = None
    default_timezone: Optional[str] = None
    accent_color: Optional[str] = None

class AIDefaultsUpdate(BaseModel):
    default_provider: Optional[str] = None
    default_model: Optional[str] = None
    default_token_limit: Optional[int] = None
    default_temperature: Optional[float] = None
    profanity_filter_enabled: Optional[bool] = None
    pii_redaction_enabled: Optional[bool] = None
    prompt_injection_shield: Optional[bool] = None
    strict_grounding: Optional[bool] = None
    competitor_blocklist: Optional[str] = None
    max_call_duration_minutes: Optional[int] = None

class GuardrailTestRequest(BaseModel):
    message: str

class SecuritySettingsUpdate(BaseModel):
    session_timeout_minutes: Optional[int] = None
    require_strong_passwords: Optional[bool] = None

class NotificationSettingsUpdate(BaseModel):
    admin_notifications_enabled: Optional[bool] = None
    system_alerts_enabled: Optional[bool] = None
    security_alerts_enabled: Optional[bool] = None
    whatsapp_number: Optional[str] = None
    slack_webhook_url: Optional[str] = None

class SystemSettingsUpdate(BaseModel):
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = None

class PricingSettingsUpdate(BaseModel):
    input_1m: Optional[float] = None
    output_1m: Optional[float] = None

class SettingsUpdateBody(BaseModel):
    platform: Optional[PlatformSettingsUpdate] = None
    ai_defaults: Optional[AIDefaultsUpdate] = None
    security: Optional[SecuritySettingsUpdate] = None
    notifications: Optional[NotificationSettingsUpdate] = None
    system: Optional[SystemSettingsUpdate] = None
    pricing: Optional[Dict[str, PricingSettingsUpdate]] = None


# Default settings factory
def get_default_settings() -> Dict[str, Any]:
    return {
        "type": "global",
        "platform": {
            "platform_name": "ZeniaOne",
            "default_language": "en-IN",
            "default_timezone": "Asia/Kolkata",
            "logo_path": None,
            "accent_color": "#0C4A31",
        },
        "ai_defaults": {
            "default_provider": "sarvam",
            "default_model": "sarvam-105b",
            "default_token_limit": 1024,
            "default_temperature": 0.7,
            "profanity_filter_enabled": True,
            "pii_redaction_enabled": True,
            "prompt_injection_shield": True,
            "strict_grounding": True,
            "competitor_blocklist": "vapi, bland, synthflow, retell, elevenlabs",
            "max_call_duration_minutes": 15,
        },
        "security": {
            "session_timeout_minutes": 60,
            "require_strong_passwords": True,
        },
        "notifications": {
            "admin_notifications_enabled": True,
            "system_alerts_enabled": True,
            "security_alerts_enabled": True,
            "whatsapp_number": "+919099887880",
            "slack_webhook_url": "",
        },
        "system": {
            "maintenance_mode": False,
            "maintenance_message": "System is currently undergoing maintenance. Please try again later.",
        },
        "pricing": {},
        "updated_at": datetime.now(timezone.utc)
    }

async def fetch_or_create_settings() -> Dict[str, Any]:
    doc = await col_platform_settings().find_one({"type": "global"})
    if not doc:
        doc = get_default_settings()
        await col_platform_settings().insert_one(doc)
    doc["_id"] = str(doc["_id"])
    return doc


def _settings_response(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return settings without binary logo storage fields.

    MongoDB stores the uploaded logo as BSON Binary. Returning that field from
    the JSON settings endpoint makes FastAPI try to UTF-8 decode PNG/JPG bytes
    and raises UnicodeDecodeError (0x89 is the PNG signature byte).
    """
    response = dict(doc)
    platform = dict(response.get("platform") or {})
    platform["has_logo"] = bool(platform.get("logo_path") or platform.get("logo_data"))
    for key in ("logo_path", "logo_data", "logo_content_type", "logo_filename"):
        platform.pop(key, None)
    response["platform"] = platform
    return response

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def get_settings(user: dict = Depends(get_platform_admin)):
    """Get all platform settings."""
    doc = await fetch_or_create_settings()
    response = _settings_response(doc)
        
    # Inject backend environment overrides for the UI
    from core.config import settings as app_settings
    response["env_overrides"] = {
        "ai_billing_enforcement": app_settings.ai_billing_enforcement
    }
    return {"settings": response}


@router.put("")
async def update_settings(
    body: SettingsUpdateBody,
    user: dict = Depends(get_platform_admin)
):
    """Update sections of platform settings."""
    current = await fetch_or_create_settings()
    
    update_data = {}
    updated_sections = []
    
    if body.platform:
        for k, v in body.platform.model_dump(exclude_unset=True).items():
            update_data[f"platform.{k}"] = v
        updated_sections.append("Platform")
            
    if body.ai_defaults:
        for k, v in body.ai_defaults.model_dump(exclude_unset=True).items():
            update_data[f"ai_defaults.{k}"] = v
        updated_sections.append("AI Defaults")
            
    if body.security:
        for k, v in body.security.model_dump(exclude_unset=True).items():
            update_data[f"security.{k}"] = v
        updated_sections.append("Security")
            
    if body.notifications:
        for k, v in body.notifications.model_dump(exclude_unset=True).items():
            update_data[f"notifications.{k}"] = v
        updated_sections.append("Notifications")
            
    if body.system:
        for k, v in body.system.model_dump(exclude_unset=True).items():
            update_data[f"system.{k}"] = v
        updated_sections.append("System")
        
    if body.pricing is not None:
        # For a dict of models, replace the whole dict
        pricing_data = {k: v.model_dump(exclude_unset=True) for k, v in body.pricing.items()}
        update_data["pricing"] = pricing_data
        updated_sections.append("Pricing")

    if not update_data:
        # Just return the current settings without modified flags if nothing to update
        doc = await fetch_or_create_settings()
        return {"success": True, "settings": _settings_response(doc)}

    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await col_platform_settings().update_one(
        {"type": "global"},
        {"$set": update_data}
    )
    
    # Log activity
    await col_activity_logs().insert_one({
        "actor_name": user.get("name", "Admin"),
        "actor_email": user.get("email"),
        "action": "settings_updated",
        "target": ", ".join(updated_sections),
        "details": f"Updated global settings sections: {', '.join(updated_sections)}",
        "created_at": datetime.now(timezone.utc)
    })
    
    doc = await fetch_or_create_settings()
    return {"success": True, "settings": _settings_response(doc)}


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    user: dict = Depends(get_platform_admin)
):
    """Upload a platform logo."""
    max_bytes = 2 * 1024 * 1024
    content_bytes = await file.read(max_bytes + 1)
    content_type = file.content_type or "image/png"
    from services.upload_validation import validate_image_upload
    validate_image_upload(content_bytes, content_type, max_bytes=max_bytes)

    filename = file.filename or "logo.png"
    storage_path = await save_upload("platform", filename, content_bytes)
    
    current = await fetch_or_create_settings()
    old_logo = current.get("platform", {}).get("logo_path")
    
    await col_platform_settings().update_one(
        {"type": "global"},
        {"$set": {
            "platform.logo_path": "mongo://platform/logo",
            "platform.logo_data": Binary(content_bytes),
            "platform.logo_content_type": content_type,
            "platform.logo_filename": filename,
            "updated_at": datetime.now(timezone.utc),
        }}
    )
    
    if old_logo:
        await delete_file(old_logo)
        
    await col_activity_logs().insert_one({
        "actor_name": user.get("name", "Admin"),
        "actor_email": user.get("email"),
        "action": "settings_updated",
        "target": "Platform Logo",
        "details": "Uploaded a new platform logo",
        "created_at": datetime.now(timezone.utc)
    })

    return {"success": True}

@router.delete("/logo")
async def remove_logo(user: dict = Depends(get_platform_admin)):
    """Remove platform logo."""
    current = await fetch_or_create_settings()
    old_logo = current.get("platform", {}).get("logo_path")
    
    if old_logo:
        await delete_file(old_logo)
        await col_platform_settings().update_one(
            {"type": "global"},
            {"$set": {
                "platform.logo_path": None,
                "platform.logo_data": None,
                "platform.logo_content_type": None,
                "platform.logo_filename": None,
                "updated_at": datetime.now(timezone.utc),
            }}
        )
        
        await col_activity_logs().insert_one({
            "actor_name": user.get("name", "Admin"),
            "actor_email": user.get("email"),
            "action": "settings_updated",
            "target": "Platform Logo",
            "details": "Removed platform logo",
            "created_at": datetime.now(timezone.utc)
        })
        
    return {"success": True}
        
@router.post("/guardrails/test", summary="Test AI Guardrails live")
async def test_guardrail(body: GuardrailTestRequest, user: dict = Depends(get_platform_admin)):
    """Simulate and evaluate real-time guardrail checks against input text."""
    doc = await fetch_or_create_settings()
    ai_defaults = doc.get("ai_defaults", {})
    
    import re
    text = body.message.strip()
    flags = []
    sanitized = text
    
    # 1. Profanity & Abuse Check
    if ai_defaults.get("profanity_filter_enabled", True):
        profane_words = ["abuse", "scam", "cheat", "bastard", "idiot", "fraud", "kill", "stupid", "bakwas", "chutiya", "harami"]
        for w in profane_words:
            if re.search(rf"\b{w}\b", text, re.IGNORECASE):
                flags.append(f"Abusive Language: Flagged keyword '{w}'")
                sanitized = re.sub(rf"\b{w}\b", "[REDACTED]", sanitized, flags=re.IGNORECASE)
                
    # 2. PII Check
    if ai_defaults.get("pii_redaction_enabled", True):
        if re.search(r"\b(?:\d[ -]*?){13,16}\b", text):
            flags.append("PII: Credit Card / Account Number detected")
            sanitized = re.sub(r"\b(?:\d[ -]*?){13,16}\b", "[CARD_REDACTED]", sanitized)
        if re.search(r"\b(?:\+91[\-\s]?)?[6-9]\d{9}\b", text):
            flags.append("PII: Phone Number detected")
            sanitized = re.sub(r"\b(?:\+91[\-\s]?)?[6-9]\d{9}\b", "[PHONE_REDACTED]", sanitized)
            
    # 3. Prompt Injection Shield
    if ai_defaults.get("prompt_injection_shield", True):
        jailbreaks = [
            r"ignore (all )?previous instructions",
            r"you are now (in )?dan mode",
            r"developer (mode|key|override)",
            r"system override",
            r"reveal (your )?secret (key|prompt)",
            r"disregard (all )?(rules|safety)",
        ]
        for pattern in jailbreaks:
            if re.search(pattern, text, re.IGNORECASE):
                flags.append("Jailbreak / Prompt Injection Attempt Intercepted")
                sanitized = "I am a secure enterprise voice assistant and cannot process override instructions."
                break
                
    # 4. Competitor Blocklist Check
    competitors_str = ai_defaults.get("competitor_blocklist") or "vapi,bland,synthflow,retell,elevenlabs"
    competitors = [c.strip() for c in competitors_str.split(",") if c.strip()]
    for comp in competitors:
        if re.search(rf"\b{re.escape(comp)}\b", text, re.IGNORECASE):
            flags.append(f"Competitor Mention Forbidden: '{comp}'")
            
    passed = len(flags) == 0
    return {
        "passed": passed,
        "flags": flags,
        "sanitized": sanitized,
        "action": "ALLOWED" if passed else "INTERCEPTED",
        "active_rules": {
            "profanity_filter": ai_defaults.get("profanity_filter_enabled", True),
            "pii_redaction": ai_defaults.get("pii_redaction_enabled", True),
            "prompt_injection_shield": ai_defaults.get("prompt_injection_shield", True),
            "strict_grounding": ai_defaults.get("strict_grounding", True),
        }
    }

@public_router.get("/public")
async def get_public_settings():
    """Public endpoint to fetch basic branding settings for login/sidebar."""
    doc = await col_platform_settings().find_one({"type": "global"})
    if not doc:
        return {"platform_name": "ZeniaOne", "has_logo": False, "accent_color": "#0C4A31"}
        
    platform = doc.get("platform", {})
    has_logo = bool(platform.get("logo_path") or platform.get("logo_data"))
    platform_name = platform.get("platform_name", "ZeniaOne")
    accent_color = platform.get("accent_color", "#0C4A31")
    
    return {
        "platform_name": platform_name,
        "has_logo": has_logo,
        "accent_color": accent_color,
    }

@public_router.get("/logo")
async def get_logo():
    """Public endpoint to fetch the logo."""
    # We do not require auth here so the login page could potentially show it,
    # or the app can just use it without complex auth headers in <img>.
    # Note: depends on your security posture, but a logo is usually public.
    
    doc = await col_platform_settings().find_one({"type": "global"})
    if not doc:
        raise HTTPException(status_code=404, detail="No settings found")
        
    platform = doc.get("platform", {})
    logo_data = platform.get("logo_data")
    if logo_data:
        return StreamingResponse(
            BytesIO(bytes(logo_data)),
            media_type=platform.get("logo_content_type") or "image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    logo_path = platform.get("logo_path")
    if not logo_path or not os.path.exists(logo_path):
        raise HTTPException(status_code=404, detail="Logo not found")
        
    return FileResponse(path=logo_path, headers={"Cache-Control": "public, max-age=86400"})
