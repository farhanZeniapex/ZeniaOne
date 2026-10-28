import logging
from typing import Optional, Dict, Any
import aiohttp
from twilio.rest import Client
from core.config import settings
from modules.telephony.provider import TelephonyProvider

logger = logging.getLogger(__name__)

class TwilioTelephonyProvider(TelephonyProvider):
    """Twilio implementation for real outbound calls."""

    def __init__(self):
        self.account_sid = settings.twilio_account_sid
        self.auth_token = settings.twilio_auth_token
        if self.account_sid and self.auth_token:
            self.client = Client(self.account_sid, self.auth_token)
        else:
            self.client = None

    async def create_call(
        self,
        to_phone: str,
        from_phone: str,
        webhook_url: str,
        metadata: Optional[Dict[str, Any]] = None,
        twiml: Optional[str] = None,
    ) -> str:
        """Initiate an outbound call and return the Twilio CallSid."""
        if not self.client:
            logger.error("Twilio credentials not configured. Cannot make outbound call.")
            return f"mock_fail_{to_phone}"
            
        try:
            status_callback = metadata.get("status_callback") if metadata else None
            
            call_params = {
                "to": to_phone,
                "from_": from_phone if from_phone and from_phone != "system_default" else settings.twilio_default_phone_number,
                "record": True,
            }
            # Inline TwiML avoids a second provider-to-Render HTTP fetch for
            # outbound test calls. The stream itself remains authenticated by
            # the WebSocket signature handler.
            if twiml:
                call_params["twiml"] = twiml
            else:
                call_params["url"] = webhook_url
            if status_callback:
                call_params["status_callback"] = status_callback
                call_params["status_callback_event"] = ['initiated', 'ringing', 'answered', 'completed']
                call_params["recording_status_callback"] = status_callback.replace("/status/", "/recording/")
                call_params["recording_status_callback_event"] = ["completed"]
                call_params["recording_status_callback_method"] = "POST"

            logger.info(
                "[TWILIO_CREATE_CALL] from=%s to=%s webhook_url=%s status_callback=%s",
                call_params["from_"],
                to_phone,
                webhook_url,
                status_callback or "",
            )
                
            call = self.client.calls.create(**call_params)
            logger.info(f"Initiated Twilio outbound call to {to_phone}. CallSid: {call.sid}")
            return call.sid
        except Exception as e:
            logger.error(f"Error creating Twilio call: {e}")
            return f"error_{to_phone}"

    def get_twiml_media_stream(self, wss_url: str) -> str:
        """Generate TwiML to connect call to websocket stream."""
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{wss_url}" />
    </Connect>
</Response>'''

    async def end_call(self, provider_call_id: str) -> bool:
        """Terminate an active call."""
        if not self.client:
            return False
            
        try:
            call = self.client.calls(provider_call_id).update(status="completed")
            return call.status == "completed"
        except Exception as e:
            logger.error(f"Error ending Twilio call {provider_call_id}: {e}")
            return False

    async def get_call_status(self, provider_call_id: str) -> str:
        """Retrieve the current status of the call from the provider."""
        if not self.client:
            return "unknown"
            
        try:
            call = self.client.calls(provider_call_id).fetch()
            return call.status
        except Exception as e:
            logger.error(f"Error fetching Twilio call {provider_call_id} status: {e}")
            return "unknown"
