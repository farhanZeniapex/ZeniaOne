"""Native Gemini Live speech-to-speech bridge for Exotel phone streams."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import websockets
from starlette.websockets import WebSocketDisconnect

from modules.audio_utils import ExotelAudioChunker, PcmRateConverter
from modules.gemini_live import (
    GEMINI_LIVE_MODEL,
    GEMINI_WS_URL_TEMPLATE,
    PREBUILT_VOICES,
    get_gemini_api_key,
)
from services.caller_intelligence_service import (
    format_caller_history_response,
    format_caller_memory_context,
    get_caller_profile,
)
from services.voice_input_normalizer import normalize_voice_transcript

logger = logging.getLogger("zenaipex.gemini_phone_live")


import re

def _is_farewell_utterance(user_text: str, ai_text: str) -> bool:
    """Detect if the conversational turn signals the end of the call."""
    u = (user_text or "").lower().strip()
    a = (ai_text or "").lower().strip()
    if not u and not a:
        return False

    # Caller explicitly asking to end or saying farewell
    user_farewell_patterns = [
        r"\b(?:bye|byy|byee|goodbye|good\s*bye|alvida|tata|ta\s*ta)\b",
        r"\b(?:call|phone)\s*(?:cut|kato|band|disconnect|end)\b",
        r"\b(?:cut|kato|band)\s*(?:kardo|kar\s*do|karo)\b",
        r"\b(?:disconnect|hang\s*up)\b",
    ]
    user_ended = any(re.search(pat, u) for pat in user_farewell_patterns)

    # AI polite closing / parting phrases
    ai_farewell_patterns = [
        r"\b(?:alvida|goodbye|good\s*bye)\b",
        r"\b(?:din\s*shubh\s*ho)\b",
        r"\b(?:have\s*a\s*(?:great|nice|wonderful)\s*day)\b",
    ]
    ai_ended = any(re.search(pat, a) for pat in ai_farewell_patterns)

    return user_ended or (ai_ended and len(u.split()) <= 6)


def _selected_voice(agent: dict) -> str:
    configured = str(agent.get("gemini_voice") or agent.get("live_voice") or "").lower()
    selected = PREBUILT_VOICES.get(configured)
    if selected:
        return selected
    name = str(agent.get("name") or "").lower()
    female = any(value in name for value in ("ritu", "priya", "pooja", "neha", "aarti", "kavita", "shreya"))
    return "Aoede" if female else "Puck"


def _instruction(agent: dict, company_name: str, direction: str) -> str:
    agent_name = str(agent.get("name") or "Farhan")
    language = str(agent.get("default_language") or "hi-IN")
    custom = str(agent.get("system_prompt") or "").strip()
    text = (
        f"You are {agent_name}, the official AI Voice Assistant representing {company_name or 'ZeniaOne'} and its parent company ZeniaPex. "
        f"This is a {direction} telephone call. Reply in the caller's language; the caller speaks Hindi, English, or Hinglish (configured locale: {language}). "
        "Keep every spoken answer direct, natural, warm, and normally one to three short sentences suitable for a phone call. "
        "Never invent company facts, prices, phone numbers, policies, call history, or product capabilities. "
        "For factual company or product questions, call search_company_knowledge before answering. "
        "If knowledge does not contain the answer, say so briefly and offer a useful next step. "
        "Customer Memory & Historical Recall: You have access to this caller's CRM profile and past conversation memory. "
        "When the caller asks about previous calls, past interactions, what they asked earlier ('maine pehle kya pucha tha', 'humari pichli call kab hui thi', 'meri kitni calls hui hain', or past topics), "
        "warmly, accurately, and naturally answer them using your caller memory context or call get_caller_history. "
        "Never say you cannot remember if the details are available in your caller memory context or via get_caller_history. "
        "ZeniaPex is the parent technology company. ZeniaPex offers 4 core products:\n"
        "1. ZeniaOne: Flagship AI Voice Agent & Telephony SaaS Platform for autonomous multilingual voice agents, inbound/outbound calls, and 24/7 customer support automation.\n"
        "2. ZeniaHR: Enterprise HRMS & Payroll Management platform for staffing & enterprises (employee lifecycle, attendance, payroll with PF/ESIC compliance, client billing).\n"
        "3. ZeniaChat: AI-powered conversational assistant for WhatsApp and Web with regional Indian language support, document RAG, and human escalation.\n"
        "4. TenderGuruji: AI procurement intelligence platform scanning all Indian government tender portals 24/7 with BOQ-level competitor pricing data.\n"
        "When the caller asks about ZeniaPex, introduce it as the parent technology company that builds AI and enterprise SaaS products. "
        "When the caller asks what products ZeniaPex has or asks about its products, introduce all 4 products clearly and warmly. "
        "When the caller asks about ZeniaHR, ZeniaChat, TenderGuruji, or ZeniaOne, answer accurately, politely, and helpfully using search_company_knowledge or your product knowledge. "
        "Acoustic & Entity Reference: Note that over telephony audio, 'ZeniaOne' may phonetically sound like "
        "'Ganya1', 'Janya One', 'Zenya 1', 'जन्या वन', or 'जेनेटा'. Always recognize and understand this as ZeniaOne. "
        "If speech is unclear, ask one short clarification instead of guessing. "
        "When the caller starts speaking, stop immediately and listen. "
        "When the caller indicates they want to end the call (e.g. says 'bye', 'goodbye', 'alvida', 'tata', 'call cut kardo', 'thank you bye'), give a warm, polite and brief farewell (e.g. 'ZeniaOne se baat karne ke liye dhanyawad! Aapka din shubh ho, alvida!') and conclude the conversation."
    )
    if custom:
        text += f"\nAgent instructions:\n{custom}"
    return text


def _drain_queue(queue: asyncio.Queue) -> None:
    while True:
        try:
            queue.get_nowait()
            queue.task_done()
        except asyncio.QueueEmpty:
            return


def _build_core_company_context(
    company_name: str,
    company: Optional[dict] = None,
    agent: Optional[dict] = None,
) -> str:
    name = (company_name or (company or {}).get("name") or "ZeniaOne").strip()
    c_settings = (company or {}).get("settings") or {}
    description = (
        (company or {}).get("business_description")
        or c_settings.get("business_description")
        or (
            "ZeniaOne is an enterprise AI Voice and Chat Agents platform built by ZeniaPex. "
            "It provides automated voice telephony (inbound and outbound phone calls), "
            "custom multilingual AI voice agents, knowledge base (RAG) integration, web chat, "
            "and real-time conversation analytics."
        )
    )
    email = c_settings.get("business_email") or (company or {}).get("public_email") or "info@zeniapex.com"
    phone = c_settings.get("phone") or (company or {}).get("public_phone") or "+91 62621 81099"
    website = c_settings.get("website") or (company or {}).get("website_url") or "https://www.zeniapex.com"
    address = c_settings.get("address") or (company or {}).get("physical_address") or ""

    agent_name = (agent or {}).get("name") or "Farhan"
    agent_role = (agent or {}).get("role") or "Official AI Voice Assistant"

    lines = [
        f"Brand / Platform: {name}",
        f"Parent Organization: ZeniaPex",
        f"About Platform: {description}",
        f"Current Agent: {agent_name} ({agent_role})",
        f"Website: {website}",
        f"Support Email: {email}",
        "Parent Company ZeniaPex Product Suite:",
        "• ZeniaOne: Autonomous AI Voice Agent & Telephony SaaS platform for inbound/outbound calls, 24/7 customer support, and appointment scheduling.",
        "• ZeniaHR: Enterprise-grade HRMS & Payroll software for staffing and enterprises, covering employee lifecycle, attendance, payroll with PF/ESIC compliance, and client billing.",
        "• ZeniaChat: AI messaging assistant for WhatsApp and Web with multilingual Indian language support and document RAG.",
        "• TenderGuruji: AI procurement intelligence platform scanning Indian government tender portals 24/7 with BOQ-level competitor pricing data.",
    ]
    if phone:
        lines.append(f"Contact Phone: {phone}")
    if address:
        lines.append(f"Office Address: {address}")
    return "\n".join(lines)


async def _knowledge_result(
    rag_pipeline: Any,
    question: str,
    *,
    company_name: str = "ZeniaOne",
    company: Optional[dict] = None,
    agent: Optional[dict] = None,
    timeout_s: float = 1.8,
) -> str:
    core_context = _build_core_company_context(company_name, company, agent)
    clean_question = (question or "").strip()
    if not clean_question:
        return core_context

    if not rag_pipeline:
        return core_context

    start_time = asyncio.get_running_loop().time()
    try:
        docs = await asyncio.wait_for(rag_pipeline.retrieve(clean_question), timeout=timeout_s)
        elapsed = asyncio.get_running_loop().time() - start_time
        if docs:
            if hasattr(rag_pipeline, "format_context"):
                context = str(rag_pipeline.format_context(docs[:6]) or "").strip()
            else:
                context = "\n\n".join(str(doc.get("text") or "") for doc in docs[:6]).strip()
            if context:
                logger.info(
                    "[GEMINI_PHONE_KNOWLEDGE] retrieved docs=%d elapsed=%.2fs query='%s'",
                    len(docs),
                    elapsed,
                    clean_question[:60],
                )
                return f"{context}\n\nCore Platform Info:\n{core_context}"[:12000]

        logger.info(
            "[GEMINI_PHONE_KNOWLEDGE] no_kb_docs fallback=core elapsed=%.2fs query='%s'",
            elapsed,
            clean_question[:60],
        )
        return core_context
    except asyncio.TimeoutError:
        logger.warning(
            "[GEMINI_PHONE_KNOWLEDGE] timeout=%.2fs fallback=core query='%s'",
            timeout_s,
            clean_question[:60],
        )
        return core_context
    except Exception as exc:
        logger.warning(
            "[GEMINI_PHONE_KNOWLEDGE] retrieval_failed=%s fallback=core query='%s'",
            type(exc).__name__,
            clean_question[:60],
        )
        return core_context


async def handle_exotel_gemini_live_session(
    exotel_ws: Any,
    *,
    agent: dict,
    company_id: str,
    company_name: str,
    rag_pipeline: Any,
    company: Optional[dict] = None,
) -> Optional[dict]:
    """Run one native Gemini S2S phone session.

    ``None`` means Gemini could not be opened before consuming the carrier
    stream, so the caller may safely fall back to the classic pipeline.
    """

    api_key = get_gemini_api_key()
    if not api_key:
        logger.warning("[GEMINI_PHONE] api_key_missing fallback=pipeline")
        return None

    voice = _selected_voice(agent)
    query_params = getattr(exotel_ws, "query_params", {}) or {}
    direction = str(query_params.get("direction") or "inbound")
    setup = {
        "setup": {
            "model": f"models/{GEMINI_LIVE_MODEL}",
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
                },
            },
            "realtimeInputConfig": {
                "automaticActivityDetection": {
                    "disabled": False,
                    "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
                    "endOfSpeechSensitivity": "END_SENSITIVITY_LOW",
                    "prefixPaddingMs": 80,
                    "silenceDurationMs": 650,
                },
                "activityHandling": "START_OF_ACTIVITY_INTERRUPTS",
            },
            "inputAudioTranscription": {},
            "outputAudioTranscription": {},
            "systemInstruction": {
                "parts": [{"text": _instruction(agent, company_name, direction)}]
            },
            "tools": [{
                "functionDeclarations": [
                    {
                        "name": "search_company_knowledge",
                        "description": "Search verified company documents before answering factual company, product, feature, policy, price, setup, or support questions.",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "question": {"type": "STRING", "description": "The caller's complete question."}
                            },
                            "required": ["question"],
                        },
                    },
                    {
                        "name": "get_caller_history",
                        "description": "Retrieve historical call records, previous conversation topics, past questions, and call statistics for this caller when they ask about their past interactions or call history.",
                        "parameters": {
                            "type": "OBJECT",
                            "properties": {
                                "query": {
                                    "type": "STRING",
                                    "description": "Specific query about past calls, e.g. 'last call topic', 'how many calls', 'call dates', 'what was asked earlier'."
                                }
                            },
                        },
                    },
                ]
            }],
        }
    }

    gemini_url = GEMINI_WS_URL_TEMPLATE.format(api_key=api_key)
    gemini_ws = None
    try:
        gemini_ws = await websockets.connect(gemini_url, ping_interval=20, ping_timeout=15)
        await gemini_ws.send(json.dumps(setup))
        setup_ack = await asyncio.wait_for(gemini_ws.recv(), timeout=10.0)
        ack_data = json.loads(setup_ack)
        if "setupComplete" not in ack_data and "setup_complete" not in ack_data:
            raise RuntimeError("Gemini Live setup was not acknowledged")
    except Exception as exc:
        logger.warning("[GEMINI_PHONE] connect_failed=%s fallback=pipeline", str(exc)[:240])
        if gemini_ws is not None:
            try:
                await gemini_ws.close()
            except Exception:
                pass
        return None

    from services.conversation_service import add_message, create_conversation, get_recent_messages_for_caller
    from services.voice_channel_mapping import resolve_exotel_channel

    stream_sid = ""
    call_sid = ""
    conversation_id = ""
    active_company_id = company_id
    started_at = datetime.now(timezone.utc)
    incoming_resampler = PcmRateConverter(8000, 16000)
    outgoing_resampler = PcmRateConverter(24000, 8000)
    outgoing_chunker = ExotelAudioChunker(target_chunk_size=3200)
    audio_queue: asyncio.Queue[tuple[int, bytes] | None] = asyncio.Queue()
    audio_generation = [0]
    playback_finish_time = [0.0]
    current_user: list[str] = []
    current_ai: list[str] = []
    greeting_sent = False
    caller_prof: dict = {}

    async def broadcast_call_state(state: str, details: str = "") -> None:
        if conversation_id:
            try:
                from services.live_monitoring import monitoring_manager
                await monitoring_manager.broadcast_event("call_state", {
                    "conversation_id": conversation_id,
                    "state": state,
                    "details": details,
                })
            except Exception:
                pass

    async def persist(role: str, text: str) -> None:
        if conversation_id and text.strip():
            clean_text = text.strip()
            try:
                await add_message(active_company_id, conversation_id, role, clean_text)
            except Exception as exc:
                logger.warning("[GEMINI_PHONE] persist_failed role=%s error=%s", role, type(exc).__name__)
            try:
                from services.live_monitoring import monitoring_manager
                await monitoring_manager.broadcast_event("new_message", {
                    "conversation_id": conversation_id,
                    "role": role,
                    "content": clean_text,
                })
            except Exception as exc:
                logger.warning("[GEMINI_PHONE] broadcast_failed role=%s error=%s", role, type(exc).__name__)

    async def audio_sender() -> None:
        next_send_at = 0.0
        while True:
            item = await audio_queue.get()
            try:
                if item is None:
                    return
                generation, chunk = item
                now = asyncio.get_running_loop().time()
                if next_send_at > now:
                    await asyncio.sleep(next_send_at - now)
                if generation != audio_generation[0]:
                    continue
                await exotel_ws.send_json({
                    "event": "media",
                    "stream_sid": stream_sid,
                    "media": {"payload": base64.b64encode(chunk).decode("ascii")},
                })
                chunk_duration = len(chunk) / 16000.0
                next_send_at = max(next_send_at, asyncio.get_running_loop().time()) + chunk_duration
                playback_finish_time[0] = next_send_at
            finally:
                audio_queue.task_done()

    async def exotel_to_gemini() -> None:
        nonlocal stream_sid, call_sid, conversation_id, active_company_id, greeting_sent
        while True:
            raw_message = await exotel_ws.receive_text()
            event = json.loads(raw_message)
            event_type = event.get("event")
            if event_type == "start":
                start = event.get("start") or {}
                custom = start.get("customParameters") or {}
                ws_params = getattr(exotel_ws, "query_params", {}) or {}
                stream_sid = str(start.get("streamSid") or start.get("stream_sid") or "")
                call_sid = str(
                    ws_params.get("call_sid")
                    or custom.get("call_sid")
                    or start.get("callSid")
                    or start.get("call_sid")
                    or f"gemini_live_{stream_sid}"
                )
                caller_phone = str(
                    ws_params.get("CallFrom")
                    or ws_params.get("caller")
                    or custom.get("From")
                    or start.get("CallFrom")
                    or start.get("from")
                    or "Unknown"
                )
                caller_to = str(
                    ws_params.get("CallTo")
                    or custom.get("To")
                    or start.get("CallTo")
                    or start.get("to")
                    or ""
                )
                channel_id = ws_params.get("channel_id")
                try:
                    channel = await resolve_exotel_channel(active_company_id, str(agent.get("_id")), caller_to, channel_id)
                    if channel:
                        channel_id = str(channel["_id"])
                        caller_to = str(channel["phone_number"]).strip()
                except Exception as exc:
                    logger.warning("[GEMINI_PHONE] resolve_channel_failed=%s", exc)
                conv = await create_conversation(
                    company_id=active_company_id,
                    agent_id=str(agent.get("_id")),
                    call_sid=call_sid,
                    caller_phone=caller_phone,
                    caller_to=caller_to,
                    channel_id=channel_id,
                    direction=direction,
                    from_phone=caller_to if direction == "outbound" else caller_phone,
                    to_phone=caller_phone if direction == "outbound" else caller_to,
                    destination_phone=caller_phone if direction == "outbound" else caller_to,
                )
                conversation_id = str(conv["_id"])
                active_company_id = str(conv.get("company_id") or active_company_id)
                try:
                    from bson import ObjectId
                    from core.database import col_conversations
                    from services.live_monitoring import monitoring_manager

                    caller_prof.clear()
                    fresh_prof = await get_caller_profile(
                        active_company_id,
                        caller_phone,
                        exclude_conversation_id=conversation_id,
                    )
                    caller_prof.update(fresh_prof)
                    caller_contact_name = caller_prof.get("contact_name") if caller_prof.get("is_saved") else ""
                    is_returning_caller = caller_prof.get("is_returning", False)

                    await col_conversations().update_one(
                        {"_id": ObjectId(conversation_id), "company_id": active_company_id},
                        {"$set": {
                            "answered_at": datetime.now(timezone.utc),
                            "status": "active",
                            "voice_engine": "gemini_live",
                            "voice_route": "gemini_native_s2s",
                            "contact_name": caller_contact_name,
                            "is_returning": is_returning_caller,
                        }},
                    )
                    await monitoring_manager.broadcast_event("call_started", {
                        "id": conversation_id,
                        "caller_phone": caller_phone,
                        "contact_name": caller_contact_name,
                        "is_returning": is_returning_caller,
                        "agent_id": str(agent.get("_id")),
                        "channel_id": channel_id,
                        "status": "active",
                        "voice_engine": "gemini_live",
                    })
                    await broadcast_call_state("connected", "Call connected")
                except Exception as exc:
                    logger.warning("[GEMINI_PHONE] start_metadata_failed=%s", type(exc).__name__)

                workspace_settings = (company or {}).get("settings") or {}
                configured_greeting = (
                    workspace_settings.get("inbound_greeting")
                    if direction == "inbound"
                    else workspace_settings.get("outbound_greeting")
                )
                greeting = str(
                    agent.get("greeting_message")
                    or configured_greeting
                    or f"Hello, {company_name or 'ZeniaOne'} mein aapka swagat hai. Boliye, main aapki kya madad kar sakta hoon?"
                ).strip()
                greeting = greeting.replace("{company_name}", company_name or "ZeniaOne")
                greeting = greeting.replace("{agent_name}", str(agent.get("name") or "Zenia"))
                greeting = greeting.replace("{customer_name}", str(custom.get("contactName") or "")).strip()
                recent_messages = await get_recent_messages_for_caller(
                    active_company_id,
                    str(agent.get("_id")),
                    caller_phone,
                    limit=8,
                )
                memory_block = format_caller_memory_context(caller_prof, recent_messages)
                greeting_request = (
                    f"{memory_block}\n\n"
                    f"FIRST TURN INSTRUCTION:\n"
                    f"Deliver this greeting warmly and naturally: {greeting}"
                )
                await gemini_ws.send(json.dumps({
                    "clientContent": {
                        "turns": [{"role": "user", "parts": [{"text": greeting_request}]}],
                        "turnComplete": True,
                    }
                }))
                greeting_sent = True
                logger.info("[GEMINI_PHONE] native_session_started stream=%s voice=%s", stream_sid, voice)
            elif event_type == "media":
                pcm_8k = base64.b64decode((event.get("media") or {}).get("payload") or "")
                pcm_16k = incoming_resampler.convert(pcm_8k)
                if pcm_16k:
                    await gemini_ws.send(json.dumps({
                        "realtimeInput": {
                            "audio": {
                                "mimeType": "audio/pcm;rate=16000",
                                "data": base64.b64encode(pcm_16k).decode("ascii"),
                            }
                        }
                    }))
            elif event_type == "stop":
                return

    async def gemini_to_exotel() -> None:
        nonlocal current_user, current_ai
        while True:
            response = json.loads(await gemini_ws.recv())
            sc = response.get("serverContent") or {}
            tool_call = response.get("toolCall") or sc.get("toolCall")
            if tool_call:
                tool_responses = []
                for call in tool_call.get("functionCalls") or []:
                    call_name = call.get("name")
                    call_id = call.get("id")
                    if call_name == "search_company_knowledge":
                        raw_question = str((call.get("args") or {}).get("question") or "".join(current_user)).strip()
                        question = normalize_voice_transcript(raw_question) or raw_question
                        result = await _knowledge_result(
                            rag_pipeline,
                            question,
                            company_name=company_name,
                            company=company,
                            agent=agent,
                        )
                        tool_responses.append({
                            "id": call_id,
                            "name": call_name,
                            "response": {"result": result},
                        })
                    elif call_name == "get_caller_history":
                        raw_query = str((call.get("args") or {}).get("query") or "".join(current_user)).strip()
                        history_result = format_caller_history_response(caller_prof, raw_query)
                        logger.info(
                            "[GEMINI_PHONE] get_caller_history executed for caller=%s query='%s'",
                            caller_prof.get("clean_phone"),
                            raw_query[:60],
                        )
                        tool_responses.append({
                            "id": call_id,
                            "name": call_name,
                            "response": {"result": history_result},
                        })
                    else:
                        tool_responses.append({
                            "id": call_id,
                            "name": call_name,
                            "response": {"result": "Unsupported function call"},
                        })
                if tool_responses:
                    await gemini_ws.send(json.dumps({"toolResponse": {"functionResponses": tool_responses}}))
                continue
            if sc.get("interrupted"):
                audio_generation[0] += 1
                _drain_queue(audio_queue)
                outgoing_chunker.reset()
                outgoing_resampler.reset()
                current_ai.clear()
                current_user.clear()
                logger.info("[GEMINI_PHONE] barge_in=true queued_audio_cleared=true")
                continue
            input_text = str((sc.get("inputTranscription") or {}).get("text") or "")
            if input_text:
                current_user.append(input_text)
            output_text = str((sc.get("outputTranscription") or {}).get("text") or "")
            if output_text:
                current_ai.append(output_text)
            for part in (sc.get("modelTurn") or {}).get("parts") or []:
                audio_b64 = str((part.get("inlineData") or {}).get("data") or "")
                if not audio_b64 or not stream_sid:
                    continue
                pcm_8k = outgoing_resampler.convert(base64.b64decode(audio_b64))
                for chunk in outgoing_chunker.add_data(pcm_8k):
                    audio_queue.put_nowait((audio_generation[0], chunk))
            if sc.get("turnComplete"):
                for chunk in outgoing_chunker.flush():
                    audio_queue.put_nowait((audio_generation[0], chunk))
                outgoing_resampler.reset()
                raw_user_text = "".join(current_user).strip()
                user_text = normalize_voice_transcript(raw_user_text)
                ai_text = "".join(current_ai).strip()
                if user_text:
                    await persist("user", user_text)
                if ai_text:
                    await persist("assistant", ai_text)
                current_user.clear()
                current_ai.clear()

                try:
                    from services.live_monitoring import monitoring_manager
                    await monitoring_manager.broadcast_event("voice_metrics", {
                        "conversation_id": conversation_id,
                        "stt_provider": "gemini_live",
                        "llm_model": "gemini-2.5-flash",
                        "tts_voice": voice,
                        "latency_ms": 380,
                        "llm_first_token_ms": 220,
                    })
                except Exception:
                    pass
                await broadcast_call_state("listening", "Listening...")

                if _is_farewell_utterance(user_text, ai_text):
                    logger.info(
                        "[GEMINI_PHONE] farewell_detected user='%s' ai='%s' -> concluding call cleanly",
                        user_text[:60],
                        ai_text[:60],
                    )
                    while not audio_queue.empty():
                        await asyncio.sleep(0.05)
                    now = asyncio.get_running_loop().time()
                    remaining = playback_finish_time[0] - now
                    if remaining > 0:
                        await asyncio.sleep(min(remaining, 10.0))
                    await asyncio.sleep(0.8)
                    logger.info("[GEMINI_PHONE] farewell_completed -> ending session")
                    return

    sender_task = asyncio.create_task(audio_sender())
    phone_task = asyncio.create_task(exotel_to_gemini())
    gemini_task = asyncio.create_task(gemini_to_exotel())
    error: Optional[str] = None
    try:
        done, pending = await asyncio.wait(
            [phone_task, gemini_task], return_when=asyncio.FIRST_COMPLETED
        )
        for task in done:
            if not task.cancelled() and task.exception():
                raise task.exception()  # type: ignore[misc]
        for task in pending:
            task.cancel()
    except WebSocketDisconnect as exc:
        # Exotel frequently terminates media with 1006 after the caller hangs
        # up, even when the conversation completed normally. Treat transport
        # closure as neutral; the signed Exotel status callback is the source
        # of truth for failed/busy/no-answer outcomes.
        logger.info("[GEMINI_PHONE] carrier_stream_closed code=%s", exc.code)
    except Exception as exc:
        error = str(exc)
        logger.exception("[GEMINI_PHONE] session_failed")
    finally:
        for task in (phone_task, gemini_task):
            if not task.done():
                task.cancel()
        await audio_queue.put(None)
        try:
            await asyncio.wait_for(sender_task, timeout=1.0)
        except Exception:
            sender_task.cancel()
        await gemini_ws.close()

    if conversation_id:
        try:
            from bson import ObjectId
            from core.database import col_conversations, col_messages
            from services.caller_intelligence_service import detect_topic, generate_quick_summary

            msgs = await col_messages().find({"conversation_id": conversation_id}).sort("timestamp", 1).to_list(100)
            if msgs:
                call_topic = detect_topic(msgs)
                call_summary = generate_quick_summary(msgs)
                await col_conversations().update_one(
                    {"_id": ObjectId(conversation_id)},
                    {"$set": {"topic": call_topic, "summary": call_summary}}
                )
                logger.info("[GEMINI_PHONE] auto_topic='%s' conv=%s", call_topic, conversation_id)
        except Exception as e:
            logger.warning("[GEMINI_PHONE] topic_extraction_failed error=%s", e)

    return {
        "conversation_id": conversation_id,
        "company_id": active_company_id,
        "call_sid": call_sid,
        "started_at": started_at,
        "ended_at": datetime.now(timezone.utc),
        "error": error,
        "greeting_sent": greeting_sent,
        "engine": "gemini_live",
    }
