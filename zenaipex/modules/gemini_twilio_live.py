"""Native Gemini Live bridge for Twilio bidirectional Media Streams."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import websockets

from modules.audio_utils import PcmRateConverter, pcm_to_mulaw, mulaw_to_pcm
from modules.gemini_live import (
    GEMINI_LIVE_MODEL,
    GEMINI_WS_URL_TEMPLATE,
    PREBUILT_VOICES,
    get_gemini_api_key,
)

logger = logging.getLogger("zenaipex.gemini_twilio_live")


def _voice(agent: dict) -> str:
    requested = str(agent.get("gemini_voice") or agent.get("live_voice") or "").lower()
    if requested in PREBUILT_VOICES:
        return PREBUILT_VOICES[requested]
    name = str(agent.get("name") or "").lower()
    return "Aoede" if any(word in name for word in ("ritu", "priya", "pooja", "neha", "aarti", "shreya")) else "Puck"


def _prompt(agent: dict, company_name: str, direction: str) -> str:
    custom = str(agent.get("system_prompt") or "").strip()
    text = (
        f"You are {agent.get('name') or 'ZeniaOne Assistant'}, the phone agent for {company_name or 'ZeniaOne'}. "
        f"This is a {direction} call. Match the caller's language and script. Keep spoken replies concise, usually one to three sentences. "
        "Answer the exact question first. Never invent company details, prices, policies, numbers, or history. "
        "For factual company, product, feature, setup, policy, or pricing questions, call search_company_knowledge first. "
        "If documents do not contain the answer, say that clearly and briefly. "
        "ZeniaOne is an enterprise AI Voice and Chat Agents platform with custom agents, Knowledge Base/RAG, web chat, browser voice, "
        "inbound and outbound phone calling, multilingual support, history, transcripts, and analytics. Do not confuse ZeniaOne with ZeniaHR. "
        "Stop speaking immediately when the caller starts talking. Ask one short clarification if speech is unclear. "
        "Only a clear goodbye, bye, or alvida ends the call."
    )
    if custom:
        text += f"\nAgent instructions:\n{custom}"
    return text


async def _knowledge(rag_pipeline: Any, question: str) -> str:
    if not rag_pipeline:
        return "No verified company knowledge is available for this question."
    try:
        docs = await rag_pipeline.retrieve(question.strip())
        if not docs:
            return "No verified company knowledge is available for this question."
        if hasattr(rag_pipeline, "format_context"):
            return str(rag_pipeline.format_context(docs[:6]) or "")[:12000]
        return "\n\n".join(str(doc.get("text") or "") for doc in docs[:6])[:12000]
    except Exception as exc:
        logger.warning("[GEMINI_TWILIO_KB] failed=%s", type(exc).__name__)
        return "Verified company knowledge is temporarily unavailable. Do not guess."


async def handle_twilio_gemini_live_session(
    websocket: Any,
    *,
    start_data: dict,
    agent_context: dict,
    rag_pipeline: Any,
) -> Optional[dict]:
    """Run native S2S after Twilio's start event has been consumed."""
    api_key = get_gemini_api_key()
    if not api_key:
        return None

    agent = agent_context["agent"]
    company = agent_context.get("company") or {}
    company_id = str(agent_context["company_id"])
    agent_id = str(agent["_id"])
    company_name = str(company.get("name") or "ZeniaOne")
    direction = str(websocket.query_params.get("direction") or "inbound")
    stream_sid = str(start_data.get("streamSid") or start_data.get("stream_sid") or "")
    call_sid = str(start_data.get("callSid") or start_data.get("call_sid") or "")
    custom = start_data.get("customParameters") or {}
    caller = str(custom.get("caller") or custom.get("CallFrom") or "Unknown")
    called = str(custom.get("called_number") or custom.get("CallTo") or "")
    contact_name = str(custom.get("contact_name") or "").strip()
    topic = str(custom.get("topic") or "").strip()
    custom_prompt = str(custom.get("system_prompt") or "").strip()
    channel_id = str(agent_context.get("channel", {}).get("_id") or "")

    setup = {
        "setup": {
            "model": f"models/{GEMINI_LIVE_MODEL}",
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": _voice(agent)}}},
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
            "systemInstruction": {"parts": [{"text": _prompt(agent, company_name, direction) + (
                f"\nThe contact is {contact_name}." if contact_name else ""
            ) + (
                f"\nOutbound objective: {topic}." if topic else ""
            ) + (
                f"\nAdditional call instruction: {custom_prompt}" if custom_prompt else ""
            )}]},
            "tools": [{"functionDeclarations": [{
                "name": "search_company_knowledge",
                "description": "Search verified company documents before answering a factual question.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {"question": {"type": "STRING"}},
                    "required": ["question"],
                },
            }]}],
        }
    }
    url = GEMINI_WS_URL_TEMPLATE.format(api_key=api_key)
    try:
        gemini_ws = await websockets.connect(url, ping_interval=20, ping_timeout=15)
        await gemini_ws.send(json.dumps(setup))
        setup_ack = json.loads(await asyncio.wait_for(gemini_ws.recv(), timeout=10.0))
        if "setupComplete" not in setup_ack and "setup_complete" not in setup_ack:
            raise RuntimeError("Gemini Live setup was not acknowledged")
    except Exception as exc:
        logger.warning("[GEMINI_TWILIO] connect_failed=%s", str(exc)[:200])
        try:
            await gemini_ws.close()  # type: ignore[possibly-undefined]
        except Exception:
            pass
        return None

    from services.conversation_service import add_message, create_conversation, get_recent_messages_for_caller

    conv = await create_conversation(
        company_id=company_id,
        agent_id=agent_id,
        channel_id=channel_id,
        call_sid=call_sid,
        caller_phone=caller,
        caller_to=called,
        direction=direction,
        language=agent.get("default_language", "en-IN"),
    )
    conversation_id = str(conv["_id"])
    started_at = datetime.now(timezone.utc)
    input_rate = PcmRateConverter(8000, 16000)
    output_rate = PcmRateConverter(24000, 8000)
    queue: asyncio.Queue[tuple[int, bytes] | None] = asyncio.Queue()
    generation = [0]
    user_text: list[str] = []
    ai_text: list[str] = []
    greeting_turn_pending = [True]

    async def save(role: str, text: str) -> None:
        if text.strip():
            await add_message(company_id, conversation_id, role, text.strip())

    async def sender() -> None:
        next_send = 0.0
        while True:
            item = await queue.get()
            try:
                if item is None:
                    return
                item_generation, pcm_8k = item
                now = asyncio.get_running_loop().time()
                if next_send > now:
                    await asyncio.sleep(next_send - now)
                if item_generation != generation[0]:
                    continue
                await websocket.send_json({
                    "event": "media",
                    "streamSid": stream_sid,
                    "media": {"payload": base64.b64encode(pcm_to_mulaw(pcm_8k)).decode("ascii")},
                })
                next_send = max(next_send, asyncio.get_running_loop().time()) + (len(pcm_8k) / 16000.0)
            finally:
                queue.task_done()

    async def receive_twilio() -> None:
        while True:
            event = json.loads(await websocket.receive_text())
            if event.get("event") == "media":
                payload = base64.b64decode((event.get("media") or {}).get("payload") or "")
                pcm_16k = input_rate.convert(mulaw_to_pcm(payload))
                if pcm_16k:
                    await gemini_ws.send(json.dumps({"realtimeInput": {"audio": {
                        "mimeType": "audio/pcm;rate=16000",
                        "data": base64.b64encode(pcm_16k).decode("ascii"),
                    }}}))
            elif event.get("event") == "stop":
                return

    async def receive_gemini() -> None:
        while True:
            response = json.loads(await gemini_ws.recv())
            content = response.get("serverContent") or {}
            tool_call = response.get("toolCall") or content.get("toolCall")
            if tool_call:
                responses = []
                for call in tool_call.get("functionCalls") or []:
                    if call.get("name") != "search_company_knowledge":
                        continue
                    question = str((call.get("args") or {}).get("question") or "".join(user_text))
                    responses.append({
                        "id": call.get("id"),
                        "name": call.get("name"),
                        "response": {"result": await _knowledge(rag_pipeline, question)},
                    })
                if responses:
                    await gemini_ws.send(json.dumps({"toolResponse": {"functionResponses": responses}}))
                continue
            if content.get("interrupted"):
                generation[0] += 1
                while not queue.empty():
                    try:
                        queue.get_nowait()
                        queue.task_done()
                    except asyncio.QueueEmpty:
                        break
                await websocket.send_json({"event": "clear", "streamSid": stream_sid})
                output_rate.reset()
                user_text.clear()
                ai_text.clear()
                continue
            incoming = str((content.get("inputTranscription") or {}).get("text") or "")
            if incoming:
                user_text.append(incoming)
            outgoing = str((content.get("outputTranscription") or {}).get("text") or "")
            if outgoing:
                ai_text.append(outgoing)
            for part in (content.get("modelTurn") or {}).get("parts") or []:
                encoded = str((part.get("inlineData") or {}).get("data") or "")
                if encoded:
                    pcm_8k = output_rate.convert(base64.b64decode(encoded))
                    for index in range(0, len(pcm_8k), 160):
                        frame = pcm_8k[index:index + 160]
                        if len(frame) == 160:
                            queue.put_nowait((generation[0], frame))
            if content.get("turnComplete"):
                if greeting_turn_pending[0]:
                    # The greeting is stored before the model turn starts;
                    # Gemini can emit duplicate output transcription for it.
                    greeting_turn_pending[0] = False
                else:
                    await save("user", "".join(user_text))
                    await save("assistant", "".join(ai_text))
                user_text.clear()
                ai_text.clear()
                output_rate.reset()

    greeting = str(
        (company.get("settings") or {}).get("inbound_greeting")
        or (agent.get("greeting_messages") or {}).get(agent.get("default_language", "en-IN"))
        or f"Hello, {company_name} mein aapka swagat hai. Boliye, main aapki kya madad kar sakta hoon?"
    ).strip()
    # Gemini may return audio for this assistant-initiated turn without
    # emitting outputTranscription. Persisting it immediately prevents a
    # real recording from appearing as a zero-message call.
    await save("assistant", greeting)
    await gemini_ws.send(json.dumps({"clientContent": {
        "turns": [{"role": "user", "parts": [{"text": f"Say exactly this greeting and nothing else: {greeting}"}]}],
        "turnComplete": True,
    }}))

    sender_task = asyncio.create_task(sender())
    twilio_task = asyncio.create_task(receive_twilio())
    gemini_task = asyncio.create_task(receive_gemini())
    error = None
    try:
        done, pending = await asyncio.wait([twilio_task, gemini_task], return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            if not task.cancelled() and task.exception():
                raise task.exception()  # type: ignore[misc]
        for task in pending:
            task.cancel()
    except Exception as exc:
        error = str(exc)
        logger.exception("[GEMINI_TWILIO] session_failed")
    finally:
        for task in (twilio_task, gemini_task):
            if not task.done():
                task.cancel()
        # A short call can end before Gemini emits turnComplete. Persist any
        # transcription already received so the call never appears as a
        # recording-only conversation with zero messages.
        if user_text:
            await save("user", "".join(user_text))
            user_text.clear()
        if ai_text:
            await save("assistant", "".join(ai_text))
            ai_text.clear()
        await queue.put(None)
        try:
            await asyncio.wait_for(sender_task, timeout=1.0)
        except Exception:
            sender_task.cancel()
        await gemini_ws.close()

    ended_at = datetime.now(timezone.utc)
    duration_seconds = max(0.0, (ended_at - started_at).total_seconds())
    from services.conversation_service import end_conversation
    from services.usage_service import increment_usage

    await end_conversation(
        company_id=company_id,
        conversation_id=conversation_id,
        status="failed" if error else "completed",
    )
    if duration_seconds > 0:
        try:
            await increment_usage(
                company_id=company_id,
                call_duration_seconds=duration_seconds,
                direction=direction,
            )
        except Exception as exc:
            logger.warning("[GEMINI_TWILIO] usage_record_failed=%s", type(exc).__name__)

    return {
        "conversation_id": conversation_id,
        "company_id": company_id,
        "started_at": started_at,
        "ended_at": ended_at,
        "error": error,
    }
