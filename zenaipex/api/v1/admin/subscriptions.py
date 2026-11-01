from fastapi import APIRouter, Query, HTTPException, Body
from core.database import col_subscriptions, col_companies, col_conversations, col_agents, col_channels
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

router = APIRouter(prefix="/subscriptions")

PLAN_PRICING = {
    "free_trial": 0,
    "starter": 4999,
    "professional": 14999,
    "enterprise": 49999,
}

@router.get("")
async def list_subscriptions(skip: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=200)):
    """List subscriptions with live minute burn rates, agent counts, and financial velocity."""
    total = await col_subscriptions().count_documents({})
    cursor = col_subscriptions().find({}).sort("created_at", -1).skip(skip).limit(limit)
    
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    
    subscriptions = []
    total_mrr = 0
    active_count = 0
    trial_count = 0
    enterprise_count = 0
    expiring_soon_count = 0
    total_burned_minutes = 0

    async for doc in cursor:
        plan_key = doc.get("plan", "free_trial").lower()
        status = doc.get("status", "trial")
        company_id_str = str(doc.get("company_id"))
        
        # Financial velocity aggregation
        plan_price = PLAN_PRICING.get(plan_key, 0)
        if status in ("active", "active_paid"):
            total_mrr += plan_price
            active_count += 1
        elif status == "trial":
            trial_count += 1
            trial_ends_at = doc.get("trial_ends_at")
            if trial_ends_at and isinstance(trial_ends_at, datetime):
                if trial_ends_at > now and (trial_ends_at - now).days <= 5:
                    expiring_soon_count += 1
        
        if plan_key == "enterprise":
            enterprise_count += 1

        # Real-time minute usage calculation from conversations
        call_docs = await col_conversations().find({
            "company_id": company_id_str,
            "started_at": {"$gte": month_start},
            "status": {"$nin": ["deleted", "demo", "test"]},
            "source_type": {"$in": ["phone_call", "voice_chat", None]},
        }, {"duration_seconds": 1}).to_list(1000)
        
        used_seconds = sum(int(c.get("duration_seconds") or 0) for c in call_docs)
        used_minutes = round(used_seconds / 60, 1)
        total_burned_minutes += used_minutes

        # Real-time agent count
        agent_count = await col_agents().count_documents({
            "company_id": company_id_str,
            "status": {"$ne": "deleted"}
        })

        # Real-time phone channel count
        channel_count = await col_channels().count_documents({
            "company_id": company_id_str,
            "is_active": True
        })

        sub = {
            "id": str(doc["_id"]),
            "company_id": company_id_str,
            "plan": plan_key,
            "status": status,
            "trial_ends_at": doc.get("trial_ends_at"),
            "limits": doc.get("limits", {}),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
            "billing_cycle": doc.get("billing_cycle", "monthly"),
            "next_billing_date": doc.get("next_billing_date"),
            "used_minutes": used_minutes,
            "active_agents_count": agent_count,
            "phone_channels_count": channel_count,
            "plan_mrr": plan_price,
        }
        
        # Attach company name and branding
        if ObjectId.is_valid(company_id_str):
            company = await col_companies().find_one({"_id": ObjectId(company_id_str)})
            if company:
                sub["company_name"] = company.get("name", "Unknown")
                sub["logo_url"] = (company.get("settings") or {}).get("logo_url")
            else:
                sub["company_name"] = "Unknown"
                sub["logo_url"] = None
        else:
            sub["company_name"] = "Unknown"
            sub["logo_url"] = None
            
        subscriptions.append(sub)

    velocity = {
        "mrr": total_mrr,
        "projected_arr": total_mrr * 12,
        "active_paid_subscriptions": active_count,
        "free_trials": trial_count,
        "enterprise_plans": enterprise_count,
        "expiring_soon": expiring_soon_count,
        "total_call_minutes_burned": round(total_burned_minutes, 1),
    }
        
    return {
        "subscriptions": subscriptions,
        "velocity": velocity,
        "pagination": {"skip": skip, "limit": limit, "total": total}
    }


@router.put("/{company_id}/limits")
async def update_subscription_limits(
    company_id: str,
    payload: Dict[str, Any] = Body(...),
):
    """Adjust custom enterprise plan limits (minutes, agents, channels) for a tenant."""
    sub = await col_subscriptions().find_one({"company_id": company_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found for this company")
    
    limits = sub.get("limits", {})
    if "call_minutes_per_month" in payload:
        limits["call_minutes_per_month"] = int(payload["call_minutes_per_month"])
    if "max_agents" in payload:
        limits["max_agents"] = int(payload["max_agents"])
    if "max_channels" in payload:
        limits["max_channels"] = int(payload["max_channels"])
    if "max_kb_docs" in payload:
        limits["max_kb_docs"] = int(payload["max_kb_docs"])
        
    update_data = {
        "limits": limits,
        "updated_at": datetime.now(timezone.utc)
    }
    if "plan" in payload:
        update_data["plan"] = payload["plan"]
    if "status" in payload:
        update_data["status"] = payload["status"]
        
    await col_subscriptions().update_one({"company_id": company_id}, {"$set": update_data})
    return {"status": "success", "limits": limits, "message": "Plan limits updated successfully"}


@router.get("/{company_id}/invoice")
async def generate_invoice_preview(company_id: str):
    """Generate instant branded tax invoice preview for a company."""
    sub = await col_subscriptions().find_one({"company_id": company_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    company_name = "Enterprise Client"
    if ObjectId.is_valid(company_id):
        comp = await col_companies().find_one({"_id": ObjectId(company_id)})
        if comp:
            company_name = comp.get("name", company_name)
            
    plan_key = sub.get("plan", "free_trial")
    base_price = PLAN_PRICING.get(plan_key, 0)
    gst_amount = round(base_price * 0.18, 2)
    total_amount = base_price + gst_amount
    
    now = datetime.now(timezone.utc)
    invoice_number = f"ZEN-{now.strftime('%Y%m')}-{company_id[-4:].upper()}"
    
    return {
        "invoice_number": invoice_number,
        "date": now.strftime("%d %B %Y"),
        "billed_to": company_name,
        "company_id": company_id,
        "plan": plan_key.title(),
        "line_items": [
            {
                "description": f"ZeniaOne AI Voice Platform - {plan_key.title()} Tier",
                "quantity": 1,
                "amount": base_price
            }
        ],
        "subtotal": base_price,
        "gst_rate": "18% IGST",
        "gst_amount": gst_amount,
        "total": total_amount,
        "currency": "INR",
        "payment_status": "PAID" if base_price > 0 else "TRIAL"
    }
