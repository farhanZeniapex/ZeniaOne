"""Read-only-provider reconciliation for admin live reporting.

Twilio is the source of truth for carrier call existence.  This module imports
missing call shells into the existing conversation collection without touching
transcripts, messages, recordings, or customer-owned fields.
"""

import logging
from typing import Any, Optional

from core.database import col_channels, col_conversations
from core.config import settings

logger = logging.getLogger(__name__)


async def sync_twilio_history(
    company_id: Optional[str] = None,
    channel_id: Optional[str] = None,
    limit: int = 100,
) -> dict[str, int]:
    """Reconcile Twilio calls for configured channels before live reporting.

    The operation is idempotent by ``(company_id, call_sid)`` and only creates
    missing conversation shells. Existing conversation content is preserved.
    """
    channel_query: dict[str, Any] = {"type": "twilio_voice", "phone_number": {"$exists": True, "$nin": [None, ""]}}
    if company_id:
        channel_query["company_id"] = company_id
    if channel_id:
        channel_query["_id"] = channel_id

    # Keep provider import lazy so admin reporting remains available when a
    # deployment has Twilio disabled or its optional SDK is unavailable.
    from modules.telephony.providers.twilio import TwilioTelephonyProvider

    provider = TwilioTelephonyProvider()
    if not provider.client:
        return {"channels": 0, "provider_calls": 0, "imported": 0, "failed": 0}

    channels = await col_channels().find(channel_query).to_list(length=200)
    # A Twilio number can be rotated in the provider console before the
    # dashboard channel record is updated. Include the configured account
    # default when the mapping is unambiguous (one active Twilio channel).
    configured_line = str(settings.twilio_default_phone_number or "").strip()
    known_lines = {str(channel.get("phone_number") or "").strip() for channel in channels}
    if configured_line and configured_line not in known_lines:
        active_candidates = [channel for channel in channels if channel.get("is_active", True)]
        if len(active_candidates) == 1:
            fallback_channel = dict(active_candidates[0])
            fallback_channel["phone_number"] = configured_line
            channels.append(fallback_channel)
    imported = 0
    provider_calls = 0
    failed = 0
    status_map = {
        "queued": "calling", "initiated": "calling", "ringing": "ringing",
        "in-progress": "in-progress", "completed": "completed", "failed": "failed",
        "busy": "busy", "no-answer": "no-answer", "canceled": "canceled",
    }

    for channel in channels:
        try:
            line = str(channel["phone_number"])
            calls = list(provider.client.calls.list(from_=line, limit=limit))
            calls += list(provider.client.calls.list(to=line, limit=limit))
            unique_calls = {str(item.sid): item for item in calls}
            provider_calls += len(unique_calls)
            for item in unique_calls.values():
                # Twilio's Python SDK exposes the API field `from` as `_from`.
                from_number = str(getattr(item, "_from", "") or getattr(item, "from_", "") or "")
                to_number = str(getattr(item, "to", "") or "")
                outbound = from_number.replace("+", "") == line.replace("+", "")
                raw_status = str(getattr(item, "status", "") or "").lower()
                doc = {
                    "company_id": str(channel["company_id"]),
                    "agent_id": str(channel.get("agent_id") or ""),
                    "channel_id": str(channel["_id"]),
                    "call_sid": str(item.sid),
                    "caller_phone": from_number,
                    "caller_to": to_number,
                    "from_phone": from_number,
                    "to_phone": to_number,
                    "destination_phone": to_number,
                    "direction": "outbound" if outbound else "inbound",
                    "source_type": "phone_call",
                    "language": "en-IN",
                    "status": status_map.get(raw_status, "failed"),
                    "provider_status": raw_status,
                    "started_at": getattr(item, "start_time", None) or getattr(item, "date_created", None),
                    "ended_at": getattr(item, "end_time", None),
                    "duration_seconds": int(getattr(item, "duration", 0) or 0),
                    "turn_count": 0,
                    "booking_confirmed": False,
                    "appointment_data": None,
                    "is_pinned": False,
                    "title": "Voice Call",
                }
                result = await col_conversations().update_one(
                    {"company_id": doc["company_id"], "call_sid": doc["call_sid"]},
                    {
                        "$setOnInsert": doc,
                        "$set": {
                            "provider_status": doc["provider_status"],
                            "status": doc["status"],
                            "source_type": "phone_call",
                            "duration_seconds": doc["duration_seconds"],
                            "ended_at": doc["ended_at"],
                        },
                    },
                    upsert=True,
                )
                if getattr(result, "upserted_id", None) is not None:
                    imported += 1
        except Exception as exc:
            failed += 1
            logger.warning("Twilio live history sync skipped for channel: %s", type(exc).__name__)

    return {"channels": len(channels), "provider_calls": provider_calls, "imported": imported, "failed": failed}
