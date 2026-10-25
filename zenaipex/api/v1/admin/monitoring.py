import logging
import secrets
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from core.dependencies import get_platform_admin

from services.live_monitoring import monitoring_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Live Monitoring"])
_monitoring_tickets: dict[str, float] = {}


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
