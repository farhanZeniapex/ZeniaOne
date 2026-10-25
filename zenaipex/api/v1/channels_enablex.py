import os
import json
import uuid
import asyncio
import logging
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
import sys

# Core & Services
from core.database import col_channels
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
router = APIRouter(tags=["EnableX Channels"])

# ── 1. HTTP Webhook ──────────────────────────────────────────────────────────

@router.post("/webhook/enablex")
@router.get("/webhook/enablex")
async def enablex_voice_webhook(request: Request):
    """
    Inbound EnableX voice webhook.
    Returns JSON instructing EnableX to open a WebSocket.
    """
    try:
        from core.config import settings
        from core.webhook_security import require_hmac_webhook
        await require_hmac_webhook(request, settings.enablex_webhook_secret, provider="EnableX")
        data = {}
        if request.method == "POST":
            # EnableX typically sends JSON payload
            try:
                data = await request.json()
            except:
                form = await request.form()
                data = dict(form)
        
        caller = data.get("from", "Unknown")
        phone_number = data.get("to", "+917935465526")
        
        logger.info(f"📞 Inbound EnableX call from {caller} to {phone_number}")

        from core.config import settings
        base_url = settings.platform_webhook_base_url
        if not base_url:
            host = request.headers.get("host", "")
            scheme = "wss" if "localhost" not in host and "127.0.0.1" not in host else "ws"
            base_url = f"{scheme}://{host}"
        else:
            base_url = base_url.replace("https://", "wss://").replace("http://", "ws://")
            
        ws_url = f"{base_url}/api/v1/webhook/enablex/media-stream?caller={caller}&to={phone_number}"
        
        # EnableX JSON Voice Prompts for WebSocket Connect
        response_json = [
            {
                "connect": {
                    "url": ws_url,
                    "eventUrl": f"{base_url.replace('wss', 'https').replace('ws', 'http')}/api/v1/webhook/enablex/events"
                }
            }
        ]
        
        return JSONResponse(content=response_json)
        
    except Exception as e:
        logger.error(f"Error in EnableX webhook: {e}")
        return JSONResponse(content=[{"hangup": {}}])

@router.post("/webhook/enablex/events")
async def enablex_events(request: Request):
    """
    Handle EnableX webhook events (like hangup) to update call status.
    """
    try:
        from core.config import settings
        from core.webhook_security import require_hmac_webhook
        await require_hmac_webhook(request, settings.enablex_webhook_secret, provider="EnableX")
        data = {}
        if request.headers.get("content-type") == "application/json":
            data = await request.json()
        else:
            form = await request.form()
            data = dict(form)
            
        logger.info(f"EnableX Event Received: {data}")
        
        voice_id = data.get("voice_id")
        state = data.get("state")
        
        if voice_id and state in ["disconnected", "failed", "completed"]:
            from services.conversation_service import end_conversation
            # End the conversation to calculate duration and update status
            status = "completed" if state == "disconnected" else state
            await end_conversation(call_sid=voice_id, status=status)
            
        # Handle recording if present
        if voice_id:
            recording_url = None
            if "recording_url" in data:
                recording_url = data["recording_url"]
            elif "recording" in data:
                rec = data["recording"]
                if isinstance(rec, list) and len(rec) > 0:
                    recording_url = rec[0] if isinstance(rec[0], str) else rec[0].get("url")
                elif isinstance(rec, str):
                    recording_url = rec
            elif "play_url" in data:
                recording_url = data["play_url"]
                
            if recording_url:
                await col_conversations().update_one({"call_sid": voice_id}, {"$set": {"recording_url": recording_url}})
            
    except Exception as e:
        logger.error(f"Error processing EnableX event: {e}")
        
    return JSONResponse(content={"status": "ok"})


# ── 2. WebSocket Media Stream ───────────────────────────────────────────────

@router.websocket("/webhook/enablex/media-stream")
async def enablex_media_stream(websocket: WebSocket, caller: str = "Unknown", to: str = ""):
    from core.config import settings
    from core.webhook_security import require_hmac_value
    try:
        require_hmac_value(str(websocket.url), websocket.query_params.get("signature", ""), settings.enablex_webhook_secret, provider="EnableX")
    except HTTPException:
        await websocket.close(code=1008, reason="Invalid EnableX media signature")
        return
    await websocket.accept()
    logger.info(f"🟢 EnableX Media stream connected for caller {caller}")
    
    # 1. Look up channel & agent
    # EnableX might strip the + sign, so check both
    to_variations = [to]
    if not to.startswith("+"):
        to_variations.append("+" + to)
        
    channel_doc = await col_channels().find_one({"phone_number": {"$in": to_variations}, "status": "active"})
    if not channel_doc:
        logger.warning(f"No active channel found for {to}")
        await websocket.close()
        return

    company_id = str(channel_doc.get("company_id", ""))
    agent_id = str(channel_doc.get("agent_id", ""))
    channel_id_str = str(channel_doc.get("_id", ""))

    agent_profile = await load_agent_for_call(agent_id, company_id)
    if not agent_profile:
        logger.error("Agent profile not found")
        await websocket.close()
        return

    # 2. Setup Services (Conversation created when 'start' event arrives)
    conv_id = None
    call_sid = None

    llm_client = AgentLLMClient(agent_profile=agent_profile)
    rag_pipeline = await get_rag_pipeline(agent_profile.get("knowledge_base_id"), company_id)
    
    audio_buffer = AudioBuffer()
    silence_detector = SilenceDetector(silence_threshold=agent_profile.get("silence_timeout_ms", 3000) / 1000.0)
    stt = TrueStreamingSTT()
    
    # Handle missing language config safely
    agent_lang = agent_profile.get("default_language", "en-IN")
    tts = SarvamRealtimeTTS(
        voice=agent_profile.get("tts_voice", "svc-366db9ac-bf2b-4aa1-9f91-d9f92074ab65"),
        target_language_code=agent_lang.split('-')[0] if '-' in agent_lang else "hi"
    )

    is_processing = False
    call_active = True
    
    # Initial Greeting
    async def send_greeting():
        greeting = agent_profile.get("greeting_messages", {}).get(agent_profile.get("default_language", "en-IN"), "Hello.")
        if conv_id:
            await add_message(conv_id, "assistant", greeting)
        
        async for audio_chunk in tts.stream_synthesize(greeting):
            if not call_active: break
            # EnableX expects base64 payload in 'media' action
            if isinstance(audio_chunk, bytes):
                mulaw_bytes = pcm_to_mulaw(audio_chunk) if len(audio_chunk) > 0 else b''
                payload = {
                    "event": "media",
                    "media": {
                        "payload": audio_to_base64(mulaw_bytes)
                    }
                }
                await websocket.send_json(payload)

    async def enablex_to_sarvam():
        nonlocal is_processing, conv_id, call_sid
        try:
            while call_active:
                message = await websocket.receive_text()
                data = json.loads(message)
                # EnableX start event
                if data.get("event") == "start":
                    call_sid = data.get("start", {}).get("call_id") or data.get("call_id", f"enx_{uuid.uuid4().hex[:12]}")
                    
                    # Fetch existing pre-created conversation, or create for inbound
                    from services.conversation_service import create_conversation
                    conv_doc = await create_conversation(
                        company_id=company_id,
                        agent_id=agent_id,
                        channel_id=channel_id_str,
                        call_sid=call_sid,
                        caller_phone=caller,
                        caller_to=to
                    )
                    conv_id = str(conv_doc["_id"])
                    
                    from datetime import datetime, timezone
                    await col_conversations().update_one(
                        {"_id": conv_doc["_id"]},
                        {"$set": {"status": "in_progress", "answered_at": datetime.now(timezone.utc)}}
                    )
                    
                    logger.info(f"Conversation {conv_id} linked with call_sid {call_sid}")
                    
                    # Now send the greeting
                    asyncio.create_task(send_greeting())
                        
                # EnableX media event
                elif data.get("event") == "media":
                    payload = data.get("media", {}).get("payload")
                    if payload and not is_processing:
                        import base64
                        pcm_audio = base64.b64decode(payload) # Assuming EnableX sends raw or encoded
                        # Add to buffer and STT
                        is_speech = silence_detector.add_audio(pcm_audio)
                        stt.add_audio(pcm_audio)
                        
                        if not is_speech and silence_detector.is_silence():
                            is_processing = True
                            text = await stt.finalize()
                            if text:
                                await handle_user_speech(text)
                            else:
                                is_processing = False
                            silence_detector.reset()
                
                elif data.get("event") == "stop":
                    break
        except WebSocketDisconnect:
            logger.info("EnableX Client disconnected")
        except Exception as e:
            logger.error(f"WebSocket read error: {e}")

    async def handle_user_speech(text: str):
        nonlocal is_processing, call_active
        if not text.strip():
            is_processing = False
            return
            
        logger.info(f"User: {text}")
        await add_message(conv_id, "user", text)
        
        context = ""
        if rag_pipeline:
            context_docs = await rag_pipeline.retrieve(text)
            context = "\n".join([d.page_content for d in context_docs])
            
        ai_response_text = ""
        async for token in llm_client.generate_streaming(text, context=context):
            if not call_active: break
            ai_response_text += token
            
        await add_message(conv_id, "assistant", ai_response_text)
        
        async for audio_chunk in tts.stream_synthesize(ai_response_text):
            if not call_active: break
            if isinstance(audio_chunk, bytes) and len(audio_chunk) > 0:
                # Convert standard PCM 16kHz to MuLaw for telephony
                import audioop
                try:
                    # Convert 16kHz to 8kHz first
                    pcm_8k, _ = audioop.ratecv(audio_chunk, 2, 1, 16000, 8000, None)
                    mulaw_bytes = audioop.lin2ulaw(pcm_8k, 2)
                    payload = {
                        "event": "media",
                        "media": {
                            "payload": audio_to_base64(mulaw_bytes)
                        }
                    }
                    await websocket.send_json(payload)
                except Exception as e:
                    pass
                    
        is_processing = False

    try:
        await enablex_to_sarvam()
    finally:
        call_active = False
        await end_conversation(conv_id)
        await increment_usage(company_id, "voice_minutes", 1)

