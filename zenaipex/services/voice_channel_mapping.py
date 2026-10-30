"""Resolve voice channels and query their conversations by the actual line number."""

import re
from typing import Any, Optional

from core.database import col_channels


VOICE_TYPES = ("twilio_voice", "exotel_voice", "exotel", "enablex", "enablex_voice")
EXOTEL_TYPES = ("exotel_voice", "exotel")


def phone_digits(value: Any) -> str:
    return re.sub(r"\D", "", str(value or ""))


def phone_numbers_match(left: Any, right: Any) -> bool:
    """Accept Indian trunk/country prefixes, without matching short numbers."""
    a, b = phone_digits(left), phone_digits(right)
    if not a or not b:
        return False
    if a == b:
        return True
    return len(a) >= 10 and len(b) >= 10 and a[-10:] == b[-10:]


def phone_variants(value: Any) -> list[str]:
    """Known stored spellings of a channel number for legacy Mongo records."""
    raw = str(value or "")
    digits = phone_digits(raw)
    variants = {raw, raw.strip(), digits}
    if digits:
        variants.add("+" + digits)
    if len(digits) == 11 and digits.startswith("0"):
        variants.update({digits[-10:], "+91" + digits[-10:], "91" + digits[-10:]})
    elif len(digits) == 12 and digits.startswith("91"):
        variants.update({digits[-10:], "0" + digits[-10:]})
    return sorted(v for v in variants if v)


def channel_conversation_query(channel: dict) -> dict:
    """Exclude restored chats and calls belonging to another phone line."""
    company_id = str(channel["company_id"])
    channel_id = str(channel["_id"])
    if channel.get("type") in VOICE_TYPES and channel.get("phone_number"):
        return {
            "company_id": company_id,
            "is_archived": {"$ne": True},
            "$or": [
                {"caller_to": {"$in": phone_variants(channel["phone_number"])}},
                {
                    "channel_id": channel_id,
                    "call_sid": {"$exists": True, "$nin": [None, ""]},
                },
            ],
        }
    if channel.get("type") == "web_chat" and channel.get("public_identifier"):
        return {"company_id": company_id, "is_archived": {"$ne": True}, "caller_to": channel["public_identifier"]}
    return {"company_id": company_id, "is_archived": {"$ne": True}, "channel_id": channel_id}


async def resolve_exotel_channel(
    company_id: str,
    agent_id: str,
    dialed_number: Any = None,
    channel_id: Optional[str] = None,
) -> Optional[dict]:
    """Prefer the dialed line, then a validated ID, then one active agent line."""
    channels = await col_channels().find({
        "company_id": str(company_id),
        "type": {"$in": EXOTEL_TYPES},
        "is_active": True,
    }).to_list(length=100)
    if phone_digits(dialed_number):
        matches = [c for c in channels if phone_numbers_match(c.get("phone_number"), dialed_number)]
        if len(matches) == 1:
            return matches[0]
    if channel_id:
        explicit = [c for c in channels if str(c["_id"]) == str(channel_id)]
        if len(explicit) == 1:
            return explicit[0]
    # A different full phone number must not be assigned to the only active
    # channel just because both channels share an agent.
    if len(phone_digits(dialed_number)) >= 10:
        return None
    agent_channels = [c for c in channels if str(c.get("agent_id")) == str(agent_id)]
    return agent_channels[0] if len(agent_channels) == 1 else None
