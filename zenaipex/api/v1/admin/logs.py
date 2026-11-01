from fastapi import APIRouter, Query, Response
from typing import Optional
import math
import re
import csv
import io
import json
from datetime import datetime, timezone
from core.database import col_activity_logs

router = APIRouter(prefix="/logs")

def _classify_severity(action: str, details: str = "") -> str:
    act = (action or "").lower()
    det = (details or "").lower()
    if any(k in act or k in det for k in ("fail", "critical", "circuit_open", "unauthorized", "refusal", "attack", "error")):
        return "critical"
    if any(k in act or k in det for k in ("warn", "exceed", "disabled", "drop", "disconnect", "expired")):
        return "warning"
    if any(k in act for k in ("create", "update", "delete", "edit", "routing", "settings", "upload")):
        return "change"
    return "info"

@router.get("")
async def get_activity_logs(
    limit: Optional[int] = Query(default=None, ge=1, le=500),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=10, le=100),
    action: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
):
    """Get platform audit events with severity grading and forensic inspection."""
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
        act = doc.get("action", "unknown")
        det = doc.get("details", "")
        sev = doc.get("severity") or _classify_severity(act, det)
        
        # If filtered by severity
        if severity and severity != "all" and sev != severity:
            continue
            
        logs.append({
            "id": str(doc["_id"]),
            "actor_name": doc.get("actor_name") or "System",
            "actor_email": doc.get("actor_email") or "system@zeniaone.ai",
            "action": act,
            "target": doc.get("target"),
            "details": det,
            "severity": sev,
            "ip_address": doc.get("ip_address") or "127.0.0.1 (Localhost)",
            "device": doc.get("device") or "Admin Console (Chrome/Windows)",
            "metadata": doc.get("metadata", {}),
            "created_at": doc.get("created_at") or datetime.now(timezone.utc),
        })

    # Stats for UI badge ribbon
    stats = {
        "total": total,
        "info": await col_activity_logs().count_documents({"action": {"$in": ["user_login", "test_chat_started"]}}),
        "changes": await col_activity_logs().count_documents({"action": {"$in": ["agent_created", "agent_updated", "settings_updated", "provider_routing_updated", "document_uploaded"]}}),
        "warnings": await col_activity_logs().count_documents({"action": {"$regex": "warn|drop|disabled", "$options": "i"}}),
    }

    return {
        "logs": logs,
        "stats": stats,
        "total": total,
        "page": page,
        "page_size": effective_page_size,
        "total_pages": max(1, math.ceil(total / effective_page_size)) if total else 1,
    }


@router.get("/export")
async def export_logs(format: str = Query(default="csv", pattern="^(csv|json)$")):
    """Export platform activity logs as CSV or JSON audit trail."""
    docs = await col_activity_logs().find({}).sort("created_at", -1).limit(1000).to_list(1000)
    
    if format == "json":
        data = []
        for d in docs:
            data.append({
                "id": str(d["_id"]),
                "time": str(d.get("created_at")),
                "actor": d.get("actor_email"),
                "action": d.get("action"),
                "target": d.get("target"),
                "details": d.get("details"),
            })
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=zeniaone_audit_logs.json"}
        )
        
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Actor Email", "Action", "Target", "Severity", "Details"])
    for d in docs:
        act = d.get("action", "")
        det = d.get("details", "")
        sev = d.get("severity") or _classify_severity(act, det)
        writer.writerow([
            str(d.get("created_at")),
            d.get("actor_email", "system"),
            act,
            d.get("target", ""),
            sev,
            det
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=zeniaone_audit_logs.csv"}
    )
