from fastapi import APIRouter, Query
from typing import Optional
import math
import re
from core.database import col_activity_logs

router = APIRouter(prefix="/logs")

@router.get("")
async def get_activity_logs(
    limit: Optional[int] = Query(default=None, ge=1, le=500),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=10, le=100),
    action: Optional[str] = None,
    search: Optional[str] = None,
):
    """Get platform audit events with safe server-side filtering."""
    query = {}
    if action and action != "all":
        query["action"] = action
    if search and search.strip():
        escaped = re.escape(search.strip())
        query["$or"] = [
            {"actor_name": {"$regex": escaped, "$options": "i"}},
            {"actor_email": {"$regex": escaped, "$options": "i"}},
            {"action": {"$regex": escaped, "$options": "i"}},
            {"target": {"$regex": escaped, "$options": "i"}},
            {"details": {"$regex": escaped, "$options": "i"}},
        ]
    total = await col_activity_logs().count_documents(query)
    effective_page_size = limit or page_size
    skip = (page - 1) * effective_page_size
    cursor = col_activity_logs().find(query).sort("created_at", -1).skip(skip).limit(effective_page_size)
    logs = []
    async for doc in cursor:
        logs.append({
            "id": str(doc["_id"]),
            "actor_name": doc.get("actor_name"),
            "actor_email": doc.get("actor_email"),
            "action": doc.get("action"),
            "target": doc.get("target"),
            "details": doc.get("details", ""),
            "created_at": doc.get("created_at")
        })
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "page_size": effective_page_size,
        "total_pages": max(1, math.ceil(total / effective_page_size)) if total else 1,
    }
