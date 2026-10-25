from fastapi import APIRouter, Query
from core.database import col_usage_records, col_companies
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter(prefix="/usage")

@router.get("")
async def list_usage(skip: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=200)):
    """List current-month usage records with bounded pagination."""
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    
    # We will fetch all usage records, but only return the current month by default
    query = {"month": current_month}
    total = await col_usage_records().count_documents(query)
    cursor = col_usage_records().find(query).sort("updated_at", -1).skip(skip).limit(limit)
    
    records = []
    async for doc in cursor:
        record = {
            "id": str(doc["_id"]),
            "company_id": doc["company_id"],
            "month": doc["month"],
            "call_minutes_used": doc.get("call_minutes_used", 0.0),
            "call_count": doc.get("call_count", 0),
            "stt_api_calls": doc.get("stt_api_calls", 0),
            "tts_api_calls": doc.get("tts_api_calls", 0),
            "llm_api_calls": doc.get("llm_api_calls", 0),
            "rag_queries": doc.get("rag_queries", 0),
            "updated_at": doc.get("updated_at"),
        }
        
        # Attach company name
        company = await col_companies().find_one({"_id": ObjectId(doc["company_id"])})
        if company:
            record["company_name"] = company.get("name", "Unknown")
        else:
            record["company_name"] = "Unknown"
            
        records.append(record)
        
    return {"usage_records": records, "month": current_month, "pagination": {"skip": skip, "limit": limit, "total": total}}
