import os
import json
import uuid
import asyncio
import logging
import time
import base64
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect, Response
from fastapi.responses import JSONResponse
from html import escape
import sys

# Core & Services
from core.database import col_channels, col_conversations
from services.agent_service import load_agent_for_call
from services.conversation_service import create_conversation, end_conversation, add_message
from services.usage_service import increment_usage

# AI & Audio Modules
from ai.llm import AgentLLMClient
from ai.rag import get_rag_pipeline

ZENAIPEX_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LEGACY_ROOT = os.path.dirname(ZENAIPEX_ROOT)
if LEGACY_ROOT not in sys.path:
    sys.path.insert(0, LEGACY_ROOT)

from modules.audio_utils import (
    AudioBuffer, SilenceDetector, audio_to_base64, mp3_to_mulaw, pcm_to_mulaw
)
from modules.sarvam_stt import TrueStreamingSTT
from modules.sarvam_tts import SarvamRealtimeTTS

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Vobiz Channels"])


# ── 1. HTTP Answer Webhook (VobizXML) ─────────────────────────────────────────

@router.api_route("/webhook/vobiz/answer", methods=["GET", "POST"])
async def vobiz_answer_webhook(request: Request):
    """
    Inbound Vobiz voice webhook (answer_url).
    Returns VobizXML instructing Vobiz to connect real-time bidirectional WebSocket stream.
    """
    data = {}
    if request.method == "POST":
        try:
            data = await request.json()
        except Exception:
            form = await request.form()
            data = dict(form)
    else:
        data = dict(request.query_params)

    caller = data.get("From") or data.get("Caller") or data.get("caller") or "Unknown"
    to_number = data.get("To") or data.get("CalledNumber") or data.get("to") or "+918065354620"
    call_uuid = data.get("CallUUID") or data.get("call_uuid") or str(uuid.uuid4())

    logger.info(f"📞 [VOBIZ] Inbound call from {caller} to {to_number} (CallUUID: {call_uuid})")

    from core.config import settings
    base_url = settings.platform_webhook_base_url
    if not base_url:
        host = request.headers.get("host", "")
        scheme = "wss" if "localhost" not in host and "127.0.0.1" not in host else "ws"
        base_url = f"{scheme}://{host}"
    else:
        base_url = base_url.replace("https://", "wss://").replace("http://", "ws://")

    from urllib.parse import urlencode
    params = urlencode({"caller": caller, "to": to_number, "call_uuid": call_uuid})
    ws_url = f"{base_url}/api/v1/webhook/vobiz/media-stream?{params}"

    # Pre-resolve channel and agent
    channel = await col_channels().find_one({"phone_number": {"$regex": to_number.replace("+", r"\+?").strip()}})
    company_id = channel.get("company_id") if channel else "6a990b403e9b17bef89acf87"
    agent_id = channel.get("agent_id") if channel else "6a990b403e9b17bef89acf8b"
    channel_id = str(channel["_id"]) if channel else None

    # Pre-create conversation in database
    asyncio.create_task(create_conversation(
        company_id=company_id,
        agent_id=agent_id,
        call_sid=call_uuid,
        caller_phone=caller,
        caller_to=to_number,
        channel_id=channel_id,
        direction="inbound"
    ))

    # Respond with VobizXML containing bidirectional stream
    xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true">{escape(ws_url)}</Stream>
</Response>"""

    return Response(content=xml_content, media_type="application/xml")


@router.api_route("/webhook/vobiz/hangup", methods=["GET", "POST"])
async def vobiz_hangup_webhook(request: Request):
    """
    Handle Vobiz call hangup event to finalize conversation records.
    """
    data = {}
    if request.method == "POST":
        try:
            data = await request.json()
        except Exception:
            form = await request.form()
            data = dict(form)
    else:
        data = dict(request.query_params)

    call_uuid = data.get("CallUUID") or data.get("call_uuid")
    if call_uuid:
        await end_conversation(call_sid=call_uuid, status="completed")
    return JSONResponse(content={"success": True})


# ── 2. Real-Time Bidirectional Audio WebSocket ───────────────────────────────

@router.websocket("/webhook/vobiz/media-stream")
async def vobiz_media_stream_websocket(websocket: WebSocket):
    """
    Real-time audio stream pipeline linking Vobiz <-> STT <-> Agent LLM <-> TTS.
    """
    await websocket.accept()
    logger.info("✅ [VOBIZ] WebSocket stream accepted!")

    query_params = dict(websocket.query_params)
    caller = query_params.get("caller", "Unknown")
    to_number = query_params.get("to", "+918065354620")
    call_uuid = query_params.get("call_uuid", "")

    # Load agent context
    agent_context = await load_agent_for_call(to_number)
    if not agent_context:
        from core.database import col_agents
        from bson import ObjectId
        agent_doc = await col_agents().find_one({"_id": ObjectId("6a990b403e9b17bef89acf8b")})
        company_id = "6a990b403e9b17bef89acf87"
        agent = agent_doc or {}
    else:
        company_id = agent_context["company_id"]
        agent = agent_context["agent"]

    agent_id = str(agent.get("_id", "6a990b403e9b17bef89acf8b"))
    language = agent.get("default_language", "en-IN")

    # Initialize LLM & RAG
    routed_agent = dict(agent)
    routed_agent["_runtime_surface"] = "phone_voice"
    try:
        llm_client = await AgentLLMClient.create(routed_agent)
    except Exception as e:
        logger.error(f"[VOBIZ] Failed to init LLM: {e}")
        llm_client = None

    rag_pipeline = get_rag_pipeline()
    tts_client = SarvamRealtimeTTS(language_code=language)
    streaming_stt = TrueStreamingSTT()

    audio_buffer = AudioBuffer(target_duration_ms=40)
    silence_detector = SilenceDetector(threshold=250, silence_duration_ms=700, min_speech_duration_ms=600)

    stream_id = None
    conversation_history = []
    is_speaking = False
    call_ended = False

    # Greeting helper
    async def _send_greeting():
        greeting = agent.get("greeting") or "Hello, thank you for calling. How can I help you today?"
        logger.info(f"🎙️ [VOBIZ] Sending greeting: {greeting}")
        try:
            audio_bytes = await tts_client.synthesize(greeting)
            if audio_bytes and stream_id:
                mulaw_data = mp3_to_mulaw(audio_bytes)
                b64_audio = audio_to_base64(mulaw_data)
                await websocket.send_text(json.dumps({
                    "event": "media",
                    "streamId": stream_id,
                    "media": {"payload": b64_audio}
                }))
                conversation_history.append({"role": "assistant", "content": greeting})
                await add_message(company_id=company_id, conversation_id=None, role="assistant", content=greeting, call_sid=call_uuid)
        except Exception as err:
            logger.warning(f"[VOBIZ] Greeting error: {err}")

    try:
        while not call_ended:
            raw_msg = await websocket.receive_text()
            data = json.loads(raw_msg)
            event = data.get("event")

            if event == "start":
                start_obj = data.get("start", {})
                stream_id = start_obj.get("streamId") or start_obj.get("callId") or data.get("streamId") or call_uuid
                logger.info(f"🚀 [VOBIZ] Audio Stream started: streamId={stream_id}")
                asyncio.create_task(_send_greeting())

            elif event == "media":
                media_obj = data.get("media", {})
                payload = media_obj.get("payload")
                if not payload or not stream_id:
                    continue

                raw_bytes = base64.b64decode(payload)
                audio_buffer.add_chunk(raw_bytes)

                while audio_buffer.has_chunk():
                    chunk = audio_buffer.get_chunk()
                    streaming_stt.add_audio(chunk)

                    state = silence_detector.process_chunk(chunk)
                    if state == "speech_started":
                        is_speaking = True

                    elif state == "speech_ended" and is_speaking:
                        is_speaking = False
                        user_text = await streaming_stt.get_final_transcript()
                        streaming_stt.reset()

                        if user_text and user_text.strip():
                            logger.info(f"🗣️ [VOBIZ] User said: {user_text}")
                            conversation_history.append({"role": "user", "content": user_text})
                            await add_message(company_id=company_id, conversation_id=None, role="user", content=user_text, call_sid=call_uuid)

                            # Fetch RAG context
                            rag_context = ""
                            if rag_pipeline:
                                docs = await rag_pipeline.query(user_text, company_id=company_id, top_k=2)
                                if docs:
                                    rag_context = "\n".join([d.get("content", "") for d in docs])

                            # Generate AI response
                            ai_text = ""
                            if llm_client:
                                ai_text = await llm_client.generate(user_text, conversation_history, rag_context=rag_context)
                            else:
                                ai_text = "I understand. Let me help you with that."

                            logger.info(f"🤖 [VOBIZ] AI replied: {ai_text}")
                            conversation_history.append({"role": "assistant", "content": ai_text})
                            await add_message(company_id=company_id, conversation_id=None, role="assistant", content=ai_text, call_sid=call_uuid)

                            # TTS Audio output
                            tts_audio = await tts_client.synthesize(ai_text)
                            if tts_audio:
                                mulaw_bytes = mp3_to_mulaw(tts_audio)
                                out_b64 = audio_to_base64(mulaw_bytes)
                                await websocket.send_text(json.dumps({
                                    "event": "media",
                                    "streamId": stream_id,
                                    "media": {"payload": out_b64}
                                }))

            elif event == "stop":
                logger.info(f"🛑 [VOBIZ] Call stopped: {stream_id}")
                call_ended = True
                break

    except WebSocketDisconnect:
        logger.info("[VOBIZ] WebSocket disconnected")
    except Exception as e:
        logger.error(f"[VOBIZ] WebSocket error: {e}", exc_info=True)
    finally:
        if call_uuid:
            await end_conversation(call_sid=call_uuid, status="completed")
