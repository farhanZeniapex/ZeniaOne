from fastapi import APIRouter, HTTPException, Depends
from core.database import (
    col_companies, col_users, col_agents, col_conversations, col_team_members, col_documents,
    col_subscriptions, col_knowledge_bases, col_channels, col_messages, col_usage_records,
    col_scheduled_calls, col_timing_metrics, col_activity_logs, col_custom_voices
)
from bson import ObjectId
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone
from slugify import slugify
from core.dependencies import get_platform_admin
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/companies")


class AdminCompanyCreate(BaseModel):
    """Initial tenant profile created by a platform administrator."""
    name: str = Field(..., min_length=2, max_length=100)
    industry: str | None = Field(default=None, max_length=100)
    country: str = Field(default="IN", max_length=5)
    timezone: str = Field(default="Asia/Kolkata", max_length=80)
    plan: str = Field(default="free_trial")
    business_email: str | None = Field(default=None, max_length=254)
    business_phone: str | None = Field(default=None, max_length=40)
    business_address: str | None = Field(default=None, max_length=400)
    business_description: str | None = Field(default=None, max_length=1000)


class AdminCompanySetupUpdate(BaseModel):
    """Admin-editable business data used by the setup readiness tracker."""
    industry: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=5)
    timezone: str | None = Field(default=None, max_length=80)
    business_email: str | None = Field(default=None, max_length=254)
    business_phone: str | None = Field(default=None, max_length=40)
    business_address: str | None = Field(default=None, max_length=400)
    business_description: str | None = Field(default=None, max_length=1000)
    business_hours: dict | None = None
    greeting_message: str | None = Field(default=None, max_length=1000)
    default_voice: str | None = Field(default=None, max_length=120)
    default_agent: str | None = Field(default=None, max_length=120)


def _setup_readiness(company: dict, *, agents: int, documents: int, channels: int) -> dict:
    """Return setup progress from real tenant records, without changing them."""
    settings = company.get("settings") or {}
    profile_ready = bool(
        settings.get("business_email")
        or settings.get("business_phone")
        or settings.get("business_address")
        or settings.get("business_description")
        or company.get("industry")
    )
    hours_ready = bool(settings.get("business_hours") or settings.get("weekly_business_hours"))
    voice_ready = bool(
        settings.get("default_voice")
        or settings.get("welcome_greeting")
        or settings.get("inbound_greeting")
        or settings.get("outbound_greeting")
    )
    steps = [
        ("Business profile", profile_ready),
        ("Business hours", hours_ready),
        ("Greeting & voice", voice_ready),
        ("AI agent", agents > 0),
        ("Knowledge", documents > 0),
        ("Channel", channels > 0),
    ]
    completed = [label for label, ready in steps if ready]
    return {
        "setup_progress": round((len(completed) / len(steps)) * 100),
        "setup_completed_steps": completed,
        "setup_total_steps": len(steps),
        "setup_missing_steps": [label for label, ready in steps if not ready],
    }

def _fmt_company(doc: dict, owner: dict = None, stats: dict = None) -> dict:
    result = {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "slug": doc["slug"],
        "industry": doc.get("industry"),
        "country": doc.get("country"),
        "plan": doc.get("plan", "free_trial"),
        "is_active": doc.get("is_active", True),
        "logo_url": (doc.get("settings") or {}).get("logo_url"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }
    if owner:
        result["owner_name"] = owner.get("name", "Unknown")
        result["owner_email"] = owner.get("email", "")
    if stats:
        result.update(stats)
    return result

@router.get("")
async def list_companies():
    """List all companies with owner and resource stats."""
    cursor = col_companies().find({}).sort("created_at", -1)
    companies = []
    async for doc in cursor:
        company_id = str(doc["_id"])
        
        # Find the owner from team_members
        owner_membership = await col_team_members().find_one(
            {"company_id": company_id, "role": "owner"}
        )
        owner = None
        if owner_membership:
            try:
                owner = await col_users().find_one({"_id": ObjectId(owner_membership["user_id"])})
            except Exception:
                pass
        
        agents_count = await col_agents().count_documents({"company_id": company_id})
        conversations_count = await col_conversations().count_documents({"company_id": company_id})
        documents_count = await col_documents().count_documents({"company_id": company_id})
        channels_count = await col_channels().count_documents({"company_id": company_id})
        
        stats = {
            "agents_count": agents_count,
            "conversations_count": conversations_count,
            "documents_count": documents_count,
            "channels_count": channels_count,
        }
        stats.update(_setup_readiness(doc, agents=agents_count, documents=documents_count, channels=channels_count))
        companies.append(_fmt_company(doc, owner=owner, stats=stats))
    return {"companies": companies}


@router.post("", status_code=201)
async def create_company(payload: AdminCompanyCreate, admin: dict = Depends(get_platform_admin)):
    """Create a tenant from the admin console and make the admin its provisional owner."""
    from models.subscription import PLAN_LIMITS
    from core.config import settings as cfg

    valid_plans = set(PLAN_LIMITS)
    if payload.plan not in valid_plans:
        raise HTTPException(status_code=400, detail="Invalid subscription plan")

    now = datetime.now(timezone.utc)
    base_slug = slugify(payload.name, max_length=55) or "company"
    slug = base_slug
    suffix = 2
    while await col_companies().find_one({"slug": slug}):
        slug = f"{base_slug[:50]}-{suffix}"
        suffix += 1

    settings = {
        "onboarding_completed": False,
        "business_email": payload.business_email or "",
        "business_phone": payload.business_phone or "",
        "business_address": payload.business_address or "",
        "business_description": payload.business_description or "",
        "created_from": "platform_admin",
    }
    company_doc = {
        "name": payload.name.strip(),
        "slug": slug,
        "industry": payload.industry or None,
        "country": payload.country.upper(),
        "timezone": payload.timezone,
        "plan": payload.plan,
        "is_active": True,
        "settings": settings,
        "created_at": now,
        "updated_at": now,
    }
    result = await col_companies().insert_one(company_doc)
    company_id = str(result.inserted_id)

    # A tenant must have an owner immediately. A user invitation can later transfer ownership.
    await col_team_members().insert_one({
        "company_id": company_id,
        "user_id": str(admin["_id"]),
        "role": "owner",
        "joined_at": now,
    })
    is_trial = payload.plan == "free_trial"
    subscription = {
        "company_id": company_id,
        "plan": payload.plan,
        "status": "trial" if is_trial else "active",
        "limits": PLAN_LIMITS[payload.plan],
        "billing_cycle": "monthly",
        "created_at": now,
        "updated_at": now,
    }
    if is_trial:
        subscription.update({
            "trial_starts_at": now,
            "trial_ends_at": now + timedelta(days=cfg.free_trial_days),
        })
    await col_subscriptions().insert_one(subscription)

    company_doc["_id"] = result.inserted_id
    return _fmt_company(company_doc, owner=admin, stats={
        "agents_count": 0, "documents_count": 0, "conversations_count": 0, "channels_count": 0,
        **_setup_readiness(company_doc, agents=0, documents=0, channels=0),
    })

@router.get("/{company_id}")
async def get_company(company_id: str):
    """Get company details along with full stats."""
    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    owner_membership = await col_team_members().find_one(
        {"company_id": company_id, "role": "owner"}
    )
    owner = None
    if owner_membership:
        try:
            owner = await col_users().find_one({"_id": ObjectId(owner_membership["user_id"])})
        except Exception:
            pass
    
    agents_count = await col_agents().count_documents({"company_id": company_id})
    conversations_count = await col_conversations().count_documents({"company_id": company_id})
    documents_count = await col_documents().count_documents({"company_id": company_id})
    channels_count = await col_channels().count_documents({"company_id": company_id})
    
    # Get all team members
    team = []
    async for member in col_team_members().find({"company_id": company_id}):
        user = None
        try:
            user = await col_users().find_one({"_id": ObjectId(member["user_id"])})
        except Exception:
            pass
        if user:
            team.append({
                "user_id": str(user["_id"]),
                "name": user.get("name"),
                "email": user.get("email"),
                "role": member.get("role"),
                "joined_at": member.get("joined_at"),
            })
    
    fmt = _fmt_company(company, owner=owner)
    fmt["stats"] = {
        "agents_count": agents_count,
        "conversations_count": conversations_count,
        "documents_count": documents_count,
        "channels_count": channels_count,
    }
    fmt["stats"].update(_setup_readiness(company, agents=agents_count, documents=documents_count, channels=channels_count))
    fmt["team"] = team
    fmt["settings"] = company.get("settings", {})
    fmt["timezone"] = company.get("timezone", "Asia/Kolkata")
    return fmt


@router.patch("/{company_id}/setup")
async def update_company_setup(company_id: str, payload: AdminCompanySetupUpdate):
    """Persist setup details from the platform company workspace."""
    try:
        company_object_id = ObjectId(company_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Company not found")
    company = await col_companies().find_one({"_id": company_object_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    values = payload.model_dump(exclude_unset=True)
    company_updates = {}
    for key in ("industry", "country", "timezone"):
        if key in values:
            company_updates[key] = values.pop(key)

    settings = dict(company.get("settings") or {})
    setting_fields = (
        "business_email", "business_phone", "business_address", "business_description",
        "business_hours", "greeting_message", "default_voice", "default_agent",
    )
    for key in setting_fields:
        if key in values:
            settings[key] = values[key]
    company_updates["settings"] = settings
    company_updates["updated_at"] = datetime.now(timezone.utc)
    await col_companies().update_one({"_id": company_object_id}, {"$set": company_updates})
    return {"success": True, "message": "Company setup saved"}


@router.get("/{company_id}/setup-options")
async def get_company_setup_options(company_id: str):
    """Return real agents and platform/company voices for the setup editor."""
    try:
        company_object_id = ObjectId(company_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Company not found")
    if not await col_companies().find_one({"_id": company_object_id}):
        raise HTTPException(status_code=404, detail="Company not found")

    agents = []
    async for agent in col_agents().find({"company_id": company_id, "status": {"$ne": "archived"}}).sort("created_at", -1):
        agents.append({
            "id": str(agent["_id"]),
            "name": agent.get("name", "Untitled agent"),
            "voice": agent.get("tts_voice") or "ritu",
            "status": agent.get("status", "draft"),
        })

    built_in = [
        ("ritu", "Ritu", "Built-in"), ("priya", "Priya", "Built-in"), ("neha", "Neha", "Built-in"),
        ("pooja", "Pooja", "Built-in"), ("shreya", "Shreya", "Built-in"), ("kavya", "Kavya", "Built-in"),
        ("rahul", "Rahul", "Built-in"), ("rohan", "Rohan", "Built-in"), ("aditya", "Aditya", "Built-in"),
        ("kabir", "Kabir", "Built-in"), ("amit", "Amit", "Built-in"),
    ]
    voices = [{"id": vid, "name": name, "source": source} for vid, name, source in built_in]
    seen = {voice["id"] for voice in voices}
    query = {"company_id": {"$in": [company_id, "admin_workspace"]}, "is_archived": {"$ne": True}}
    async for voice in col_custom_voices().find(query).sort("created_at", -1):
        voice_id = str(voice.get("voice_id") or voice["_id"])
        if voice_id in seen:
            continue
        seen.add(voice_id)
        voices.insert(0, {"id": voice_id, "name": voice.get("name", "Unnamed clone"), "source": "Cloned voice"})
    return {"agents": agents, "voices": voices}

@router.patch("/{company_id}/status")
async def update_company_status(company_id: str, payload: dict):
    """Update company active status."""
    is_active = payload.get("is_active", True)
    result = await col_companies().update_one(
        {"_id": ObjectId(company_id)},
        {"$set": {"is_active": is_active}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"success": True, "is_active": is_active}

@router.patch("/{company_id}/subscription")
async def update_company_subscription(company_id: str, payload: dict):
    """Update company subscription plan."""
    plan = payload.get("plan")
    if not plan:
        raise HTTPException(status_code=400, detail="Plan is required")
        
    from services.tenant_service import upgrade_plan
    from core.exceptions import NotFoundError
    
    try:
        success = await upgrade_plan(company_id, plan)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update subscription")
        return {"success": True, "plan": plan}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{company_id}")
async def delete_company(company_id: str):
    """Permanently delete a company and all associated resources."""
    if company_id == "6a990b403e9b17bef89acf87":
        raise HTTPException(status_code=403, detail="The INTERNAL / PLATFORM company cannot be deleted.")

    company = await col_companies().find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Proceed with deletion sweep
    from ai.vector_store import NamespacedVectorStore

    try:
        # Delete Pinecone namespaces for any KBs this company owns
        kbs = await col_knowledge_bases().find({"company_id": company_id}).to_list(None)
        for kb in kbs:
            namespace = kb.get("pinecone_namespace")
            if namespace:
                try:
                    vs = NamespacedVectorStore(namespace=namespace)
                    vs._get_index().delete(delete_all=True, namespace=namespace)
                    logger.info(f"Cleared Pinecone namespace {namespace} for deleted company {company_id}")
                except Exception as e:
                    logger.warning(f"Failed to clear Pinecone namespace {namespace}: {e}")

        # Cascade deletes
        filter_query = {"company_id": company_id}
        
        await col_team_members().delete_many(filter_query)
        await col_subscriptions().delete_many(filter_query)
        await col_agents().delete_many(filter_query)
        await col_knowledge_bases().delete_many(filter_query)
        await col_documents().delete_many(filter_query)
        await col_channels().delete_many(filter_query)
        
        # Messages usually use conversation_id or company_id. If only conversation_id, we should fetch convos.
        # But our DB schema for col_messages likely includes company_id since it's tenant-isolated.
        await col_messages().delete_many(filter_query)
        await col_conversations().delete_many(filter_query)
        await col_usage_records().delete_many(filter_query)
        await col_scheduled_calls().delete_many(filter_query)
        await col_timing_metrics().delete_many(filter_query)
        
        # Finally delete company itself
        await col_companies().delete_one({"_id": ObjectId(company_id)})
        
        # Log the deletion as an admin action
        await col_activity_logs().insert_one({
            "action": "company_deleted",
            "company_id": company_id,
            "details": f"Company {company['name']} was permanently deleted.",
            # Note: The `get_platform_admin` doesn't pass the current admin to the endpoint directly in kwargs here unless we ask for it,
            # but we can omit it or update the endpoint signature to include current_user.
        })
        
        logger.info(f"Successfully deleted company {company_id} and all associated data.")
        return {"success": True, "message": "Company and all associated data permanently deleted."}
    except Exception as e:
        logger.error(f"Error deleting company {company_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete company")
