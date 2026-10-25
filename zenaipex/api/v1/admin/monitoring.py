import logging
import secrets
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from datetime import datetime, timedelta, timezone
from core.dependencies import get_platform_admin
from core.config import settings
from core.database import col_background_jobs, col_llm_requests, get_db_mode

from services.live_monitoring import monitoring_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Live Monitoring"])
_monitoring_tickets: dict[str, float] = {}


def _build_monitoring_alerts(queue_counts: dict, recent_failures: int, providers: dict) -> list[dict]:
    alerts = []
    if queue_counts.get("failed", 0):
        alerts.append({"code": "background_jobs_failed", "severity": "warning", "count": queue_counts["failed"]})
    if recent_failures >= 10:
        alerts.append({"code": "ai_failures_elevated", "severity": "warning", "count": recent_failures})
    for name, details in providers.items():
        if details.get("state") == "OPEN":
            alerts.append({"code": "provider_circuit_open", "severity": "critical", "provider": name})
    return alerts


@router.get("/monitoring-summary")
async def monitoring_summary(_: dict = Depends(get_platform_admin)):
    """Return live operational signals for alerting and admin diagnostics."""
    now = datetime.now(timezone.utc)
    recent_since = now - timedelta(hours=24)
    queue_counts = {
        status: await col_background_jobs().count_documents({"status": status})
        for status in ("pending", "running", "failed")
    }
    recent_failures = await col_llm_requests().count_documents({
        "success": False,
        "timestamp": {"$gte": recent_since},
    })
    from ai.llm import _provider_health
    providers = {
        name: {
            "state": details.get("circuit_state", "HEALTHY"),
            "consecutive_failures": details.get("consecutive_failures", 0),
            "avg_latency": round(float(details.get("avg_latency", 0) or 0), 2),
            "last_failure_reason": details.get("last_failure_reason"),
        }
        for name, details in _provider_health.items()
    }
    db_mode = get_db_mode()
    alerts = _build_monitoring_alerts(queue_counts, recent_failures, providers)
    return {
        "generated_at": now,
        "database": {
            "mode": db_mode["db_mode"],
            "persistent": db_mode["persistent"],
            "status": "healthy" if db_mode["persistent"] else "attention_required",
        },
        "background_jobs": queue_counts,
        "ai_failures_last_24h": recent_failures,
        "providers": providers,
        "alerts": alerts,
        "integrations": {
            "sentry_configured": bool(settings.sentry_dsn),
            "redis_configured": bool(settings.redis_url),
        },
    }


@router.get("/live-monitoring-ticket")
async def create_live_monitoring_ticket(_: dict = Depends(get_platform_admin)):
    now = time.time()
    for ticket, expires_at in list(_monitoring_tickets.items()):
        if expires_at <= now:
            _monitoring_tickets.pop(ticket, None)
    ticket = secrets.token_urlsafe(32)
    _monitoring_tickets[ticket] = now + 30
    return {"ticket": ticket, "expires_in": 30}

@router.websocket("/live-monitoring")
async def live_monitoring_ws(websocket: WebSocket):
    """
    WebSocket endpoint for the Admin Dashboard to receive live call events.
    """
    ticket = websocket.query_params.get("ticket")
    expires_at = _monitoring_tickets.pop(ticket, 0) if ticket else 0
    if not expires_at or expires_at <= time.time():
        await websocket.close(code=1008, reason="Platform admin authentication required")
        return

    logger.info(">>> LIVE MONITORING WS CONNECTION ATTEMPT")
    await monitoring_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for ping or messages from client if needed
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        monitoring_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"[LIVE_MONITORING] WebSocket error: {e}")
        monitoring_manager.disconnect(websocket)
