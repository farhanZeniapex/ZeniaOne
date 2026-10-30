"""
Zenaipex AI — Caller Intelligence & Memory Service.

Provides caller CRM profiles, historical call aggregation, contact naming,
topic detection, conversation summarization, and AI caller memory.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from core.database import col_conversations, col_leads, col_messages

logger = logging.getLogger(__name__)


def normalize_phone_number(raw_phone: str) -> str:
    """Extract standard clean 10-digit phone number."""
    if not raw_phone:
        return ""
    digits = re.sub(r"\D", "", str(raw_phone))
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def format_phone_display(raw_phone: str) -> str:
    """Format clean phone into +91 XXXXX XXXXX standard format."""
    clean = normalize_phone_number(raw_phone)
    if len(clean) == 10:
        return f"+91 {clean[:5]} {clean[5:]}"
    return raw_phone or "Unknown Number"


FILLER_PATTERNS = [
    r"^(hi|hello|hey|namaste|halo)\b",
    r"^(how are you|kaise ho|kya haal|sab theek)\b",
    r"^(ok|okay|theek hai|accha|haan|nahi|no|yes)\b",
    r"^(bye|goodbye|alvida|tata|thank you|thanks|dhanyawad|shukriya)\b",
    r"^(sun rahe ho|awaz aa rahi|hello hello)\b",
]


def detect_topic(messages: List[Dict[str, Any]]) -> str:
    """Accurately identify conversation topic based on customer and assistant turns."""
    text = " ".join(
        str(m.get("text") or m.get("content") or "").lower() for m in messages
    )
    if not text.strip():
        return "General Enquiry"

    found_topics: List[str] = []
    if any(k in text for k in ("zeniahr", "attendance", "payroll", "salary", "pf", "esic", "slip")) or re.search(r"\bhr\b", text):
        found_topics.append("ZeniaHR Platform")
    if any(k in text for k in ("zeniacat", "whatsapp", "messaging")) or re.search(r"\bchat\b|\bbot\b", text):
        found_topics.append("ZeniaChat Platform")
    if any(k in text for k in ("tender", "guruji", "tenderguruji", "bid", "procurement", "boq")):
        found_topics.append("TenderGuruji Intelligence")
    if any(k in text for k in ("price", "pricing", "cost", "plan", "subscription", "charge")):
        found_topics.append("Pricing & Plans")
    if any(k in text for k in ("create agent", "setup", "configure", "prompt")) or re.search(r"\bagent\b", text):
        found_topics.append("Agent Configuration")
    if any(k in text for k in ("support", "issue", "error", "problem", "help")):
        found_topics.append("Technical Support")
    if any(k in text for k in ("zeniaone", "ganya", "janya", "zenya", "voicebot")):
        found_topics.append("ZeniaOne Platform")

    if len(found_topics) > 1:
        return " & ".join(found_topics[:2])
    elif found_topics:
        return found_topics[0]
    return "General Consultation"


def generate_quick_summary(messages: List[Dict[str, Any]]) -> str:
    """Generate concise 1-2 sentence summary of conversation focusing on substantive inquiries."""
    substantive: List[str] = []
    for m in messages:
        if m.get("role") != "user":
            continue
        text = str(m.get("text") or m.get("content") or "").strip()
        if len(text) < 4:
            continue
        t_lower = text.lower()
        is_filler = False
        for pat in FILLER_PATTERNS:
            if re.search(pat, t_lower) and len(t_lower.split()) <= 4:
                is_filler = True
                break
        if any(term in t_lower for term in ("thank you", "thanks", "dhanyawad", "bye", "goodbye", "alvida")):
            if len(t_lower.split()) <= 4:
                is_filler = True
        if not is_filler:
            clean = re.sub(r"^(ah|um|uh|arey|bhai|yaar|toh|haan)\s*[,!.\-]?\s*", "", text, flags=re.IGNORECASE).strip()
            substantive.append(clean or text)

    if not substantive:
        return "Short conversation with no recorded inquiries."
    if len(substantive) == 1:
        return f"Customer asked: '{substantive[0][:90]}'."
    if len(substantive) == 2:
        return f"Customer asked about '{substantive[0][:60]}' and '{substantive[1][:60]}'."
    return f"Customer asked about '{substantive[0][:50]}', '{substantive[1][:50]}', and {len(substantive)-2} further question(s)."


async def get_caller_profile(
    company_id: str,
    phone: str,
    exclude_conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch complete caller profile, statistics, timeline, and AI memory."""
    clean_phone = normalize_phone_number(phone)
    if not clean_phone:
        return {
            "phone": phone or "Unknown",
            "clean_phone": "",
            "contact_name": "Unknown Caller",
            "is_saved": False,
            "is_returning": False,
            "stats": {
                "total_calls": 0,
                "inbound_calls": 0,
                "outbound_calls": 0,
                "completed_calls": 0,
                "failed_calls": 0,
                "total_talk_time_seconds": 0,
                "avg_duration_seconds": 0,
            },
            "timeline": [],
            "ai_memory": {"last_topic": "Not available", "notes": []},
        }

    phone_regex = re.compile(rf"{re.escape(clean_phone)}$")

    # 1. Look up saved contact in leads
    contact_name = None
    contact_email = None
    contact_notes = []
    lead = await col_leads().find_one(
        {"company_id": company_id, "phone": {"$regex": phone_regex}}
    )
    if lead:
        contact_name = lead.get("name")
        contact_email = lead.get("email")
        if lead.get("notes"):
            contact_notes.append(lead.get("notes"))

    # 2. Query all historical conversations matching this phone
    query: Dict[str, Any] = {
        "company_id": company_id,
        "$or": [
            {"caller_phone": {"$regex": phone_regex}},
            {"from_phone": {"$regex": phone_regex}},
            {"to_phone": {"$regex": phone_regex}},
            {"caller_to": {"$regex": phone_regex}},
        ],
    }
    if exclude_conversation_id:
        try:
            query["_id"] = {"$ne": ObjectId(exclude_conversation_id)}
        except Exception:
            pass

    conv_docs = await col_conversations().find(query).sort("started_at", -1).to_list(100)

    # If contact_name was not in leads, check if saved in any conversation
    if not contact_name:
        for c in conv_docs:
            if c.get("contact_name") and c.get("contact_name") not in ("None", "inbound", "Unknown"):
                contact_name = c.get("contact_name")
                break

    # 3. Calculate statistics
    total_calls = len(conv_docs)
    inbound_count = sum(1 for c in conv_docs if c.get("direction") == "inbound")
    outbound_count = sum(1 for c in conv_docs if c.get("direction") == "outbound")
    completed_count = sum(1 for c in conv_docs if c.get("status") == "completed")
    failed_count = sum(1 for c in conv_docs if c.get("status") in ("failed", "busy", "no-answer", "canceled"))
    total_duration = sum(int(c.get("duration_seconds") or 0) for c in conv_docs)
    avg_duration = round(total_duration / total_calls) if total_calls > 0 else 0

    is_returning = total_calls >= 1 if exclude_conversation_id else total_calls > 1

    # 4. Build timeline
    timeline = []
    last_topic = "Not available"
    last_summary = "No previous call found"

    for i, c in enumerate(conv_docs):
        cid = str(c["_id"])
        # Check messages for topic if not stored
        c_topic = c.get("topic")
        c_summary = c.get("summary")
        has_recording = bool(c.get("recording_url"))

        # If not cached on doc, inspect message count / sample
        msg_count = c.get("message_count") or c.get("turn_count") or 0
        has_transcript = msg_count > 0

        if not c_topic and has_transcript:
            # Fetch sample messages to compute topic
            msgs = await col_messages().find({"conversation_id": cid}).sort("timestamp", 1).to_list(10)
            if msgs:
                c_topic = detect_topic(msgs)
                c_summary = generate_quick_summary(msgs)
                has_transcript = True

        if not c_topic:
            c_topic = "Product information" if c.get("direction") == "outbound" else "General Call"
        if not c_summary:
            c_summary = "Call completed with voice agent."

        if i == 0:
            last_topic = c_topic
            last_summary = c_summary

        timeline.append({
            "id": cid,
            "call_sid": c.get("call_sid"),
            "date": c.get("started_at"),
            "ended_at": c.get("ended_at"),
            "direction": c.get("direction", "inbound"),
            "duration_seconds": c.get("duration_seconds", 0),
            "status": c.get("status", "completed"),
            "topic": c_topic,
            "summary": c_summary,
            "has_recording": has_recording,
            "has_transcript": has_transcript,
            "recording_url": c.get("recording_url"),
        })

    display_name = contact_name or "Unknown Caller"
    display_phone = format_phone_display(clean_phone)

    return {
        "phone": display_phone,
        "raw_phone": phone,
        "clean_phone": clean_phone,
        "contact_name": display_name,
        "is_saved": bool(contact_name),
        "is_returning": is_returning,
        "email": contact_email,
        "stats": {
            "total_calls": total_calls,
            "inbound_calls": inbound_count,
            "outbound_calls": outbound_count,
            "completed_calls": completed_count,
            "failed_calls": failed_count,
            "total_talk_time_seconds": total_duration,
            "avg_duration_seconds": avg_duration,
        },
        "last_conversation": {
            "date": conv_docs[0].get("started_at") if conv_docs else None,
            "topic": last_topic,
            "summary": last_summary,
            "duration_seconds": conv_docs[0].get("duration_seconds", 0) if conv_docs else 0,
        } if conv_docs else None,
        "timeline": timeline,
        "ai_memory": {
            "last_topic": last_topic,
            "important_notes": contact_notes if contact_notes else "No saved notes",
        },
    }


async def save_caller_contact(
    company_id: str,
    phone: str,
    name: str,
    email: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Save or update caller contact information across leads and historical conversations."""
    clean_phone = normalize_phone_number(phone)
    if not clean_phone or not name.strip():
        raise ValueError("Valid phone number and name are required")

    clean_name = name.strip()
    phone_regex = re.compile(rf"{re.escape(clean_phone)}$")
    now = datetime.now(timezone.utc)

    # 1. Upsert in leads
    lead_doc = {
        "company_id": company_id,
        "name": clean_name,
        "phone": f"+91{clean_phone}",
        "email": email or "",
        "notes": notes or "",
        "updated_at": now,
    }
    await col_leads().update_one(
        {"company_id": company_id, "phone": {"$regex": phone_regex}},
        {"$set": lead_doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    # 2. Update all conversations matching this phone
    conv_query = {
        "company_id": company_id,
        "$or": [
            {"caller_phone": {"$regex": phone_regex}},
            {"from_phone": {"$regex": phone_regex}},
            {"to_phone": {"$regex": phone_regex}},
            {"caller_to": {"$regex": phone_regex}},
        ],
    }
    await col_conversations().update_many(
        conv_query,
        {"$set": {"contact_name": clean_name, "updated_at": now}},
    )

    logger.info("[CALLER_CRM] Saved contact name='%s' phone='%s' company='%s'", clean_name, clean_phone, company_id)
    return {
        "success": True,
        "contact_name": clean_name,
        "clean_phone": clean_phone,
    }


def format_caller_memory_context(
    caller_prof: Dict[str, Any],
    recent_messages: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Format structured caller CRM memory for Gemini Live context injection."""
    name = caller_prof.get("contact_name") or "Unknown"
    is_saved = caller_prof.get("is_saved", False)
    is_returning = caller_prof.get("is_returning", False)
    stats = caller_prof.get("stats") or {}
    total_calls = stats.get("total_calls", 0)
    phone = caller_prof.get("phone") or "Unknown"
    last_conv = caller_prof.get("last_conversation") or {}
    timeline = caller_prof.get("timeline") or []

    lines = [
        "=== CALLER CRM & HISTORICAL MEMORY ===",
        f"Phone Number: {phone}",
        f"Saved Contact Name: {name if is_saved else 'Unsaved Contact'}",
        f"Customer Relationship: {'Returning Customer' if is_returning else 'First-Time Caller'}",
        f"Total Prior Calls: {total_calls}",
    ]

    if is_returning and last_conv:
        last_date = last_conv.get("date")
        if hasattr(last_date, "strftime"):
            date_str = last_date.strftime("%d %b %Y, %I:%M %p UTC")
        else:
            date_str = str(last_date or "Recently")
        lines.append(f"Last Call Date/Time: {date_str}")
        lines.append(f"Last Call Duration: {last_conv.get('duration_seconds', 0)} seconds")
        lines.append(f"Last Call Topic: {last_conv.get('topic') or 'General Enquiry'}")
        lines.append(f"Last Call Summary: {last_conv.get('summary') or 'Call completed'}")

    if timeline and is_returning:
        lines.append("Past Calls Timeline (Most Recent First):")
        for t in timeline[:4]:
            t_date = t.get("date")
            t_str = t_date.strftime("%d %b %Y, %I:%M %p") if hasattr(t_date, "strftime") else str(t_date)
            lines.append(
                f"- {t_str} ({t.get('direction', 'inbound')}, {t.get('duration_seconds', 0)}s): "
                f"Topic: {t.get('topic')} | Summary: {t.get('summary')}"
            )

    if recent_messages:
        dialogue = "\n".join(
            f"{m.get('role')}: {m.get('text')}"
            for m in recent_messages
            if m.get("text")
        )[-2000:]
        if dialogue.strip():
            lines.append(f"Recent Spoken Turns:\n{dialogue}")

    lines.append(
        "MEMORY USAGE DIRECTIVES:\n"
        "- This is private CRM memory. Do not recite it blindly in your first greeting.\n"
        "- When the caller asks about past interactions ('maine pehle kya pucha tha', 'humari pichli call kab hui thi', "
        "'meri kitni calls hui hain', or past topics), respond accurately, naturally, and warmly in Hindi/Hinglish using this memory.\n"
        "- If the caller asks for further historical records, the `get_caller_history` tool is available to look up past logs."
    )
    lines.append("=======================================")
    return "\n".join(lines)


def format_caller_history_response(caller_prof: Dict[str, Any], query: str = "") -> str:
    """Format full caller history response for the get_caller_history tool."""
    stats = caller_prof.get("stats") or {}
    timeline = caller_prof.get("timeline") or []
    name = caller_prof.get("contact_name") or "Caller"
    total_calls = stats.get("total_calls", 0)
    phone = caller_prof.get("phone") or "Unknown"

    if not caller_prof.get("is_returning") or total_calls == 0:
        return f"Caller {name} ({phone}) has no prior recorded calls. This is their first call."

    lines = [
        f"Historical Call Records for {name} ({phone}):",
        f"- Total Calls: {total_calls} (Inbound: {stats.get('inbound_calls', 0)}, Outbound: {stats.get('outbound_calls', 0)})",
        f"- Total Talk Time: {stats.get('total_talk_time_seconds', 0)} seconds (Average: {stats.get('avg_duration_seconds', 0)}s per call)",
    ]

    last_conv = caller_prof.get("last_conversation")
    if last_conv:
        last_date = last_conv.get("date")
        date_str = last_date.strftime("%d %b %Y, %I:%M %p UTC") if hasattr(last_date, "strftime") else str(last_date)
        lines.append(f"- Last Call: {date_str} (Duration: {last_conv.get('duration_seconds', 0)}s) | Topic: {last_conv.get('topic')} | Summary: {last_conv.get('summary')}")

    lines.append("Prior Calls History:")
    for idx, t in enumerate(timeline[:6], 1):
        t_date = t.get("date")
        t_str = t_date.strftime("%d %b %Y, %I:%M %p") if hasattr(t_date, "strftime") else str(t_date)
        lines.append(
            f"{idx}. {t_str} | Direction: {t.get('direction')} | Duration: {t.get('duration_seconds')}s | Status: {t.get('status')} | Topic: {t.get('topic')} | Summary: {t.get('summary')}"
        )

    return "\n".join(lines)

