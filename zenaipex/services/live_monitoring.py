import asyncio
import json
import logging
from typing import List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class LiveMonitoringManager:
    def __init__(self):
        # List of connected admin websockets
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"[LIVE_MONITORING] Admin connected. Total admins: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"[LIVE_MONITORING] Admin disconnected. Total admins: {len(self.active_connections)}")

    async def broadcast_event(self, event_type: str, payload: Dict[str, Any]):
        """
        Broadcast an event to all connected admin clients.
        event_type can be: 'call_started', 'call_ended', 'new_message', 'status_update'
        """
        if not self.active_connections:
            return

        message = {
            "event": event_type,
            "data": payload
        }
        
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"[LIVE_MONITORING] Failed to send message to an admin: {e}")
                dead_connections.append(connection)
                
        for dead in dead_connections:
            self.disconnect(dead)

# Global singleton instance
monitoring_manager = LiveMonitoringManager()
