"""Optional, safe automatic knowledge snapshot generator."""
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict

from core.database import col_companies

logger = logging.getLogger(__name__)
AUTO_DOC_FILENAME = "_auto_platform_snapshot.txt"


async def run_auto_kb_update_all() -> Dict[str, Any]:
    results: Dict[str, Any] = {"success": 0, "failed": 0, "skipped": 0, "errors": []}
    async for company in col_companies().find({}, {"_id": 1, "name": 1}):
        try:
            result = await run_auto_kb_update_for_company(str(company["_id"]), company.get("name", "Workspace"))
            status = result.get("status", "skipped")
            results[status] = results.get(status, 0) + 1
        except Exception as exc:
            results["failed"] += 1
            results["errors"].append({"company_id": str(company["_id"]), "error": type(exc).__name__})
            logger.exception("Automatic knowledge snapshot failed for company %s", company["_id"])
    return results


async def run_auto_kb_update_for_company(company_id: str, company_name: str = "Workspace") -> Dict[str, Any]:
    """Generate metadata without writing vectors outside the ingestion pipeline."""
    snapshot = await _generate_snapshot_document(company_id, company_name)
    return {
        "status": "skipped",
        "reason": "snapshot_generated_only",
        "company_id": company_id,
        "content_hash": hashlib.sha256(snapshot.encode("utf-8")).hexdigest(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def _generate_snapshot_document(company_id: str, company_name: str) -> str:
    now = datetime.now(timezone.utc).isoformat()
    return "\n".join([
        f"# {company_name} - Platform Knowledge Snapshot",
        f"Company ID: {company_id}",
        f"Generated: {now}",
        "This snapshot is generated from current workspace metadata.",
    ])
