from fastapi import APIRouter, Query
from core.database import col_subscriptions, col_companies
from bson import ObjectId

router = APIRouter(prefix="/subscriptions")

@router.get("")
async def list_subscriptions(skip: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=200)):
    """List subscriptions with bounded pagination."""
    total = await col_subscriptions().count_documents({})
    cursor = col_subscriptions().find({}).sort("created_at", -1).skip(skip).limit(limit)
    subscriptions = []
    async for doc in cursor:
        sub = {
            "id": str(doc["_id"]),
            "company_id": doc["company_id"],
            "plan": doc.get("plan", "free_trial"),
            "status": doc.get("status", "trial"),
            "trial_ends_at": doc.get("trial_ends_at"),
            "limits": doc.get("limits", {}),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
            "billing_cycle": doc.get("billing_cycle", "monthly"),
            "next_billing_date": doc.get("next_billing_date"),
        }
        
        # Attach company name
        company = await col_companies().find_one({"_id": ObjectId(doc["company_id"])})
        if company:
            sub["company_name"] = company.get("name", "Unknown")
            sub["logo_url"] = (company.get("settings") or {}).get("logo_url")
        else:
            sub["company_name"] = "Unknown"
            sub["logo_url"] = None
            
        subscriptions.append(sub)
        
    return {"subscriptions": subscriptions, "pagination": {"skip": skip, "limit": limit, "total": total}}
