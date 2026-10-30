"""Native Gemini Live speech-to-speech bridge for Exotel phone streams."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import websockets

from modules.audio_utils import ExotelAudioChunker, PcmRateConverter
from modules.gemini_live import (
    GEMINI_LIVE_MODEL,
    GEMINI_WS_URL_TEMPLATE,
    PREBUILT_VOICES,
    get_gemini_api_key,
)

logger = logging.getLogger("zenaipex.gemini_phone_live")


def _selected_voice(agent: dict) -> str:
    configured = str(agent.get("gemini_voice") or agent.get("live_voice") or "").lower()
    selected = PREBUILT_VOICES.get(configured)
    if selected:
        return selected
    name = str(agent.get("name") or "").lower()
    female = any(value in name for value in ("ritu", "priya", "pooja", "neha", "aarti", "kavita", "shreya"))
    return "Aoede" if female else "Puck"


def _instruction(agent: dict, company_name: str, direction: str) -> str:
    agent_name = str(agent.get("name") or "AI Assistant")
    language = str(agent.get("default_language") or "en-IN")
    custom = str(agent.get("system_prompt") or "").strip()
    text = (
        f"You are {agent_name}, the phone voice agent for {company_name or 'ZeniaOne'}. "
        f"This is a {direction} telephone call. Reply in the caller's language; the configured locale is {language}. "
        "Keep every spoken answer direct, natural, and normally one to three short sentences. "
        "Never invent company facts, prices, phone numbers, policies, call history, or product capabilities. "
        "For factual company or product questions, call search_company_knowledge before answering. "
        "If knowledge does not contain the answer, say so briefly and offer a useful next step. "
        "The brand is exactly ZeniaOne. ZeniaOne is an enterprise AI Voice and Chat Agents platform. "
        "It supports custom AI agents, Knowledge Base/RAG, web chat, browser voice, inbound and outbound "
        "phone calls through configured telephony channels, multilingual conversations, conversation history, "
        "and usage analytics. Do not confuse it with ZeniaHR or unrelated products. "
        "If speech is unclear, ask one short clarification instead of guessing. "
        "When the caller starts speaking, stop immediately and listen. "
        "Only treat a clear bye, goodbye, or alvida as a request to end the conversation."
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


async def _knowledge_result(rag_pipeline: Any, question: str) -> str:
    if not rag_pipeline or not question.strip():
        return "No verified company knowledge was found for this question."
    try:
        docs = await rag_pipeline.retrieve(question.strip())
        if not docs:
            return "No verified company knowledge was found for this question."
        if hasattr(rag_pipeline, "format_context"):
            context = str(rag_pipeline.format_context(docs[:6]) or "").strip()
        else:
            context = "\n\n".join(str(doc.get("text") or "") for doc in docs[:6]).strip()
        return context[:12000] or "No verified company knowledge was found for this question."
    except Exception as exc:
        logger.warning("[GEMINI_PHONE_KNOWLEDGE] retrieval_failed=%s", type(exc).__name__)
        return "Verified company knowledge is temporarily unavailable. Do not guess the answer."


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
                "functionDeclarations": [{
                    "name": "search_company_knowledge",
                    "description": "Search verified company documents before answering factual company, product, feature, policy, price, setup, or support questions.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "question": {"type": "STRING", "description": "The caller's complete question."}
                        },
                        "required": ["question"],
                    },
                }]
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
    current_user: list[str] = []
    current_ai: list[str] = []
    greeting_sent = False

    async def persist(role: str, text: str) -> None:
        if conversation_id and text.strip():
            try:
                await add_message(active_company_id, conversation_id, role, text.strip())
            except Exception as exc:
                logger.warning("[GEMINI_PHONE] persist_failed role=%s error=%s", role, type(exc).__name__)

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
                next_send_at = max(next_send_at, asyncio.get_running_loop().time()) + (len(chunk) / 16000.0)
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
                channel = await resolve_exotel_channel(active_company_id, str(agent.get("_id")), caller_to, channel_id)
                if channel:
                    channel_id = str(channel["_id"])
                    caller_to = str(channel["phone_number"]).strip()
                conv = await create_conversation(
                    company_id=active_company_id,
                    agent_id=str(agent.get("_id")),
                    call_sid=call_sid,
                    caller_phone=caller_phone,
                    caller_to=caller_to,
                    direction=direction,
                    from_phone=caller_to if direction == "outbound" else caller_phone,
                    to_phone=caller_phone if direction == "outbound" else caller_to,
                    destination_phone=caller_phone if direction == "outbound" else caller_to,
                    channel_id=channel_id,
                )
                conversation_id = str(conv["_id"])
                active_company_id = str(conv.get("company_id") or active_company_id)
                try:
                    from bson import ObjectId
                    from core.database import col_conversations
                    from services.live_monitoring import monitoring_manager

                    await col_conversations().update_one(
                        {"_id": ObjectId(conversation_id), "company_id": active_company_id},
                        {"$set": {
                            "answered_at": datetime.now(timezone.utc),
                            "status": "active",
                            "voice_engine": "gemini_live",
                            "voice_route": "gemini_native_s2s",
                        }},
                    )
                    await monitoring_manager.broadcast_event("call_started", {
                        "id": conversation_id,
                        "caller_phone": caller_phone,
                        "agent_id": str(agent.get("_id")),
                        "channel_id": channel_id,
                        "status": "active",
                        "voice_engine": "gemini_live",
                    })
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
                history_context = "\n".join(
                    f"{item.get('role')}: {item.get('text')}"
                    for item in recent_messages
                    if item.get("text")
                )[-4000:]
                greeting_request = f"Say exactly this greeting and nothing else: {greeting}"
                if history_context:
                    greeting_request = (
                        "Private context from this caller's recent conversations follows. "
                        "Do not read it aloud; use it only if the caller refers back to it.\n"
                        f"{history_context}\n\n{greeting_request}"
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
                    if call.get("name") != "search_company_knowledge":
                        continue
                    question = str((call.get("args") or {}).get("question") or "".join(current_user)).strip()
                    result = await _knowledge_result(rag_pipeline, question)
                    tool_responses.append({
                        "id": call.get("id"),
                        "name": "search_company_knowledge",
                        "response": {"result": result},
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
                user_text = "".join(current_user).strip()
                ai_text = "".join(current_ai).strip()
                if user_text:
                    await persist("user", user_text)
                if ai_text:
                    await persist("assistant", ai_text)
                current_user.clear()
                current_ai.clear()

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
