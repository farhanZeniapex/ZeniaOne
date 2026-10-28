"""
Zenaipex AI — Twilio Channels API and Webhooks.

Handles inbound Twilio calls, providing TwiML and the WebSocket media stream.
"""
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response, JSONResponse
from typing import Optional
import uuid
import json
import asyncio
import time
from urllib.parse import urlparse
from datetime import datetime, timezone

from core.database import col_channels, col_conversations
from services.agent_service import load_agent_for_call
from services.conversation_service import create_conversation, end_conversation, add_message
from services.usage_service import increment_usage, check_call_minute_limit, check_ai_credit_limit
from ai.llm import AgentLLMClient
from ai.rag import get_rag_pipeline

import sys
import os
# Add legacy root to path so we can import legacy audio modules
ZENAIPEX_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LEGACY_ROOT = os.path.dirname(ZENAIPEX_ROOT)
if LEGACY_ROOT not in sys.path:
    sys.path.insert(0, LEGACY_ROOT)

from modules.audio_utils import (
    AudioBuffer, SilenceDetector, audio_to_base64, mp3_to_mulaw
)
from modules.sarvam_stt import TrueStreamingSTT
from modules.sarvam_tts import SarvamRealtimeTTS
import logging
from html import escape

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Twilio Webhooks"])

DEFAULT_PHONE_WELCOME = "Hello, thank you for calling ZeniaOne. How may I help you today?"
_SUPPORTED_SARVAM_SPEAKERS = {
    "aditya", "ritu", "ashutosh", "priya", "neha", "rahul", "pooja", "rohan",
    "simran", "kavya", "amit", "dev", "ishita", "shreya", "ratan", "varun",
    "manan", "sumit", "roopa", "kabir", "aayan", "shubh", "advait", "anand",
    "tanya", "tarun", "sunny", "mani", "gokul", "vijay", "shruti", "suhani",
    "mohit", "kavitha", "rehan", "soham", "rupali",
}


def _sarvam_tts_speaker(agent: dict) -> str:
    """Return a voice supported by the configured Bulbul model.

    Older agent records used ``anushka`` as a default, but that voice is not
    supported by Bulbul v3. A safe fallback prevents the WebSocket from being
    closed before the caller hears the greeting.
    """
    requested = str(agent.get("tts_voice") or "ritu").strip().lower()
    if requested.startswith("svc-") or requested in _SUPPORTED_SARVAM_SPEAKERS:
        return requested
    logger.warning("[TWILIO_TTS] unsupported_speaker=%s fallback=ritu", requested)
    return "ritu"


def _twilio_external_url(request: Request) -> str:
    """Return the URL Twilio signed, accounting for a reverse proxy/tunnel."""
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    forwarded_proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    if forwarded_host:
        url = f"{forwarded_proto}://{forwarded_host}{request.url.path}"
        if request.url.query:
            url += f"?{request.url.query}"
        return url
    return str(request.url)


def _twilio_websocket_external_url(websocket_url: str, forwarded_host: str = "", forwarded_proto: str = "") -> str:
    """Build the public URL Twilio used when signing a media WebSocket.

    Render forwards a public ``wss://`` request to the app as an internal
    WebSocket request and commonly reports ``x-forwarded-proto: https``.
    Signature validation must therefore translate HTTP proxy schemes back to
    their external WebSocket equivalents.
    """
    if not forwarded_host:
        return websocket_url
    parsed = urlparse(websocket_url)
    public_scheme = {
        "https": "wss",
        "http": "ws",
    }.get(str(forwarded_proto or "").lower(), forwarded_proto or "wss")
    return f"{public_scheme}://{forwarded_host}{parsed.path}{('?' + parsed.query) if parsed.query else ''}"


def _validate_twilio_signature(request: Request, params: dict) -> None:
    """Validate Twilio webhooks without breaking local tunnel development.

    Twilio's outbound webhook in the local ngrok flow can arrive without an
    X-Twilio-Signature header. Production must still reject unsigned requests;
    development accepts that specific missing-header case so the media stream
    can be tested locally. When a signature is present it is always checked
    against the public forwarded URL (including query parameters).
    """
    from core.config import settings
    from twilio.request_validator import RequestValidator

    signature = request.headers.get("X-Twilio-Signature", "")
    logger.info(
        "[TWILIO_WEBHOOK_REQUEST] path=%s host=%s forwarded_host=%s forwarded_proto=%s method=%s query_keys=%s signature_present=%s",
        request.url.path,
        request.headers.get("host", ""),
        request.headers.get("x-forwarded-host", ""),
        request.headers.get("x-forwarded-proto", ""),
        request.method,
        sorted(dict(request.query_params).keys()),
        bool(signature),
    )
    if not signature:
        if settings.is_production:
            raise HTTPException(status_code=401, detail="Missing Twilio webhook signature")
        logger.warning("Twilio webhook arrived without X-Twilio-Signature; allowing in development")
        return
    signed_url = _twilio_external_url(request)
    if not RequestValidator(settings.twilio_auth_token).validate(signed_url, params, signature):
        logger.error(
            "[TWILIO_WEBHOOK_REJECTED] path=%s signed_url=%s reason=invalid_signature",
            request.url.path,
            signed_url,
        )
        raise HTTPException(status_code=401, detail="Invalid Twilio webhook signature")


async def _validate_twilio_webhook(request: Request) -> dict:
    from core.config import settings
    form_data = await request.form() if request.method == "POST" else request.query_params
    if settings.is_production and not settings.twilio_auth_token:
        raise HTTPException(status_code=503, detail="Twilio webhook validation is not configured")
    if settings.twilio_auth_token:
        _validate_twilio_signature(request, dict(form_data))
    return dict(form_data)


def _twilio_stream_status_url(settings, company_id: str = "", agent_id: str = "", channel_id: str = "") -> str:
    base = str(settings.platform_webhook_base_url or "").rstrip("/")
    suffix = f"/{company_id}/{agent_id}/{channel_id}" if company_id else ""
    return f"{base}/api/v1/webhook/twilio/stream-status{suffix}" if base else ""

# ── 1. HTTP Webhook (TwiML) ───────────────────────────────────────────────────

@router.post("/webhook/twilio/{company_slug}/voice")
async def twilio_voice_webhook(company_slug: str, request: Request):
    """
    Inbound Twilio voice webhook.
    Returns TwiML instructing Twilio to open a WebSocket to our /media-stream endpoint.
    """
    form = await _validate_twilio_webhook(request)
    phone_number = form.get("To")  # The Twilio number that was dialed
    caller = form.get("From")
    call_sid = form.get("CallSid")

    logger.info(f"📞 Inbound call from {caller} to {phone_number} (company: {company_slug})")

    from core.config import settings
    base_url = settings.platform_webhook_base_url
    if not base_url:
        if settings.is_production:
            raise HTTPException(status_code=503, detail="PLATFORM_WEBHOOK_BASE_URL is not configured")
        host = request.headers.get("host", "")
        scheme = "wss" if "localhost" not in host and "127.0.0.1" not in host else "ws"
        base_url = f"{scheme}://{host}"
    else:
        base_url = base_url.replace("https://", "wss://").replace("http://", "ws://")
        
    # Note: Using the generic /webhook/twilio/media-stream endpoint,
    # the company will be resolved by the phone number dialed,
    # or passed as a query param.
    # Twilio Media Streams does not accept query-string values on the Stream
    # URL; pass call metadata through <Parameter> below instead.
    ws_url = f"{base_url}/api/v1/webhook/twilio/media-stream"
    stream_status_url = _twilio_stream_status_url(settings)
    stream_status_attr = (
        f' statusCallback="{escape(stream_status_url, quote=True)}" statusCallbackMethod="POST"'
        if stream_status_url else ""
    )

    # Start the bidirectional AI stream immediately. A hard-coded Twilio
    # <Say> here makes callers hear an unrelated English voice first and also
    # delays the actual agent stream until that sentence has finished.
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{escape(ws_url, quote=True)}"{stream_status_attr}>
            <Parameter name="caller" value="{escape(str(caller or ''), quote=True)}" />
            <Parameter name="called_number" value="{escape(str(phone_number or ''), quote=True)}" />
            <Parameter name="call_sid" value="{escape(str(call_sid or ''), quote=True)}" />
            <Parameter name="skip_greeting" value="false" />
        </Stream>
    </Connect>
</Response>
"""
    return Response(content=twiml, media_type="text/xml")


@router.api_route("/webhook/twilio/twiml/{company_id}/{agent_id}/{channel_id}", methods=["GET", "POST"])
async def twilio_outbound_twiml(company_id: str, agent_id: str, channel_id: str, request: Request):
    """
    Outbound Twilio voice webhook for test calls.
    Returns TwiML instructing Twilio to open a WebSocket to our /media-stream endpoint.
    """
    from core.config import settings
    form = await _validate_twilio_webhook(request)
    base_url = settings.platform_webhook_base_url
    if not base_url:
        if settings.is_production:
            raise HTTPException(status_code=503, detail="PLATFORM_WEBHOOK_BASE_URL is not configured")
        host = request.headers.get("host", "")
        scheme = "wss" if "localhost" not in host and "127.0.0.1" not in host else "ws"
        base_url = f"{scheme}://{host}"
    else:
        base_url = base_url.replace("https://", "wss://").replace("http://", "ws://")
    
    # The Media Stream start event only contains values explicitly passed as
    # TwiML custom parameters. Without these, the stream cannot resolve the
    # outbound channel/agent and the caller hears silence before the call fails.
    # Keep the Stream URL query-free. Twilio requires custom values to be sent
    # as <Parameter> children, which are read from start.customParameters.
    ws_url = f"{base_url}/api/v1/webhook/twilio/media-stream"
    stream_status_url = _twilio_stream_status_url(settings, company_id, agent_id, channel_id)
    stream_status_attr = (
        f' statusCallback="{escape(stream_status_url, quote=True)}" statusCallbackMethod="POST"'
        if stream_status_url else ""
    )
    caller = str(form.get("To") or "")
    called_number = str(form.get("From") or settings.twilio_default_phone_number or "")
    call_sid = str(form.get("CallSid") or "")
    contact_name = str(request.query_params.get("contact_name") or "")
    topic = str(request.query_params.get("topic") or "")
    system_prompt = str(request.query_params.get("system_prompt") or "")
    welcome = DEFAULT_PHONE_WELCOME

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{escape(ws_url, quote=True)}"{stream_status_attr}>
            <Parameter name="direction" value="outbound" />
            <Parameter name="caller" value="{escape(caller, quote=True)}" />
            <Parameter name="called_number" value="{escape(called_number, quote=True)}" />
            <Parameter name="call_sid" value="{escape(call_sid, quote=True)}" />
            <Parameter name="contact_name" value="{escape(contact_name, quote=True)}" />
            <Parameter name="topic" value="{escape(topic, quote=True)}" />
            <Parameter name="system_prompt" value="{escape(system_prompt, quote=True)}" />
            <Parameter name="skip_greeting" value="false" />
        </Stream>
    </Connect>
</Response>
"""
    logger.info(
        "[TWILIO_TWIML_READY] company_id=%s agent_id=%s channel_id=%s call_sid=%s ws_url=%s",
        company_id,
        agent_id,
        channel_id,
        call_sid,
        ws_url,
    )
    return Response(content=twiml, media_type="text/xml")


@router.api_route("/webhook/twilio/stream-status", methods=["GET", "POST"])
@router.api_route("/webhook/twilio/stream-status/{company_id}/{agent_id}/{channel_id}", methods=["GET", "POST"])
async def twilio_stream_status_webhook(
    request: Request,
    company_id: str = "",
    agent_id: str = "",
    channel_id: str = "",
):
    """Receive Twilio Media Stream status/error callbacks for diagnosis."""
    form = await _validate_twilio_webhook(request)
    logger.warning(
        "[TWILIO_STREAM_STATUS] company=%s agent=%s channel=%s call_sid=%s "
        "stream_sid=%s status=%s error_code=%s error=%s",
        company_id,
        agent_id,
        channel_id,
        form.get("CallSid", ""),
        form.get("StreamSid", ""),
        form.get("StreamStatus", ""),
        form.get("StreamErrorCode", ""),
        form.get("StreamError", ""),
    )
    return {"status": "ok"}


@router.api_route("/webhook/twilio/status/{company_id}/{agent_id}/{channel_id}", methods=["GET", "POST"])
async def twilio_status_webhook(company_id: str, agent_id: str, channel_id: str, request: Request):
    """Callback to receive terminal call status from Twilio."""
    try:
        from core.config import settings
        if request.method == "POST":
            form_data = await request.form()
        else:
            form_data = request.query_params

        if settings.is_production and not settings.twilio_auth_token:
            raise HTTPException(status_code=503, detail="Twilio webhook validation is not configured")
        if settings.twilio_auth_token:
            _validate_twilio_signature(request, dict(form_data))
            
        call_sid = str(form_data.get("CallSid", ""))
        status = str(form_data.get("CallStatus", ""))
        
        if not call_sid or not status:
            return {"status": "ok"}
            
        logger.info("\n📡 TWILIO STATUS CALLBACK")
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info(f"📞 Call SID : {call_sid}")
        logger.info(f"📊 Status   : {status}")
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
        
        internal_status = status.lower()
        if internal_status == "answered":
            internal_status = "in-progress"
        if internal_status not in ["completed", "failed", "busy", "no-answer", "canceled", "in-progress", "ringing"]:
            internal_status = "unknown"
            
        from datetime import datetime, timezone
        
        update_data = {"status": internal_status, "provider_status": status.lower()}
        if internal_status == "in-progress":
            update_data["answered_at"] = datetime.now(timezone.utc)
        
        if internal_status in ["completed", "failed", "busy", "no-answer", "canceled"]:
            update_data["ended_at"] = datetime.now(timezone.utc)
            
        duration = str(form_data.get("CallDuration") or "")
        if duration and duration.isdigit():
            update_data["duration_seconds"] = int(duration)
            
        error_code = str(form_data.get("ErrorCode") or "").strip()
        error_message = str(form_data.get("ErrorMessage") or "").strip()
        if error_code or error_message:
            update_data["failure_reason"] = " · ".join(
                part for part in (error_code, error_message) if part
            )
            
        scoped = {"call_sid": call_sid, "company_id": company_id, "agent_id": agent_id}
        result = await col_conversations().update_one(scoped, {"$set": update_data})
        if result.matched_count == 0:
            await col_conversations().update_one({"call_sid": call_sid}, {"$set": update_data})
        
    except Exception as e:
        logger.error(f"Error in Twilio Status Webhook: {e}")
        
    return {"status": "ok"}


@router.api_route("/webhook/twilio/recording/{company_id}/{agent_id}/{channel_id}", methods=["GET", "POST"])
async def twilio_recording_webhook(company_id: str, agent_id: str, channel_id: str, request: Request):
    """Persist Twilio's asynchronous recording URL and duration."""
    try:
        form_data = await _validate_twilio_webhook(request)
        call_sid = str(form_data.get("CallSid") or "").strip()
        recording_url = str(form_data.get("RecordingUrl") or "").strip()
        recording_sid = str(form_data.get("RecordingSid") or "").strip()
        recording_status = str(form_data.get("RecordingStatus") or "").strip().lower()
        duration = str(form_data.get("RecordingDuration") or "").strip()
        if not call_sid or not recording_url:
            return {"status": "ok"}
        update = {
            "recording_url": recording_url,
            "recording_sid": recording_sid or None,
            "recording_status": recording_status or "completed",
        }
        if duration.isdigit():
            update["recording_duration"] = int(duration)
        scoped = {"call_sid": call_sid, "company_id": company_id, "agent_id": agent_id}
        result = await col_conversations().update_one(scoped, {"$set": update})
        if result.matched_count == 0:
            await col_conversations().update_one({"call_sid": call_sid}, {"$set": update})
        logger.info("[TWILIO_RECORDING] saved call_sid=%s recording_sid=%s", call_sid, recording_sid)
    except Exception as exc:
        logger.error("Error in Twilio recording webhook: %s", exc)
    return {"status": "ok"}


# ── 2. Background Audio Helper ────────────────────────────────────────────────
import base64
BACKGROUND_AUDIO_CACHE = []

def load_background_audio():
    global BACKGROUND_AUDIO_CACHE
    try:
        from pydub import AudioSegment
        audio_path = os.path.join(LEGACY_ROOT, "asset", "Office Background Ambience _ Free Sound Effect-[AudioTrimmer.com].mp3")
        if not os.path.exists(audio_path):
            return
        audio = AudioSegment.from_mp3(audio_path).set_channels(1).set_frame_rate(8000).set_sample_width(2) - 1
        pcm_data = audio.raw_data
        try:
            import audioop
        except ImportError:
            import audioop_lts as audioop
        mulaw_data = audioop.lin2ulaw(pcm_data, 2)
        chunk_size = 160
        BACKGROUND_AUDIO_CACHE = [base64.b64encode(mulaw_data[i:i + chunk_size]).decode() 
                                  for i in range(0, len(mulaw_data), chunk_size) if len(mulaw_data[i:i+chunk_size]) == chunk_size]
    except Exception as e:
        logger.warning(f"Could not load background audio: {e}")

load_background_audio()

async def start_background_audio_loop(websocket: WebSocket, stream_sid: str, session: dict):
    if not BACKGROUND_AUDIO_CACHE or not session.get("enable_background_audio", False):
        return
    chunk_index = 0
    try:
        while not session.get("call_ended", False):
            chunk_b64 = BACKGROUND_AUDIO_CACHE[chunk_index]
            try:
                await websocket.send_json({
                    "event": "media",
                    "streamSid": stream_sid,
                    "media": {"payload": chunk_b64}
                })
            except Exception:
                break
            chunk_index = (chunk_index + 1) % len(BACKGROUND_AUDIO_CACHE)
            await asyncio.sleep(0.02)
    except asyncio.CancelledError:
        pass


# ── 3. Voice Processing Loop ──────────────────────────────────────────────────

async def process_voice_turn(websocket: WebSocket, stream_sid: str, session: dict, transcript: str):
    """Multi-tenant voice processing pipeline (STT -> RAG -> LLM -> TTS)."""
    transcript = transcript.strip()
    if not transcript:
        return
        
    company_id = session["company_id"]
    agent_id = session["agent_id"]
    conversation_id = session["conversation_id"]
    llm_client: AgentLLMClient = session["llm_client"]
    rag_pipeline = session["rag_pipeline"]
    
    # 1. Add user message to transcript
    await add_message(company_id, conversation_id, "user", transcript, session["language"])
    
    # 2. Check for goodbye
    def detect_goodbye(text: str, language: str) -> bool: return "bye" in text.lower() or "alvida" in text.lower()
    def should_end_call_after_response(response: str, user_text: str, session: dict) -> bool: return False
    def normalize_text_for_tts(text: str, language: str) -> str: return text
    
    if detect_goodbye(transcript, session["language"]):
        session["call_ended"] = True
        return
        
    # 3. RAG Retrieval
    context_docs = None
    if rag_pipeline.should_retrieve(transcript, session["language"]):
        context_docs = await rag_pipeline.retrieve(transcript)
        session["rag_queries"] += 1
        
    # 4. LLM Generation + Streaming TTS
    try:
        session["is_speaking"] = True
        session["llm_api_calls"] += 1
        
        # We use standard Sarvam TTS for this integration
        from modules.sarvam_tts import SarvamRealtimeTTS
        speaker = _sarvam_tts_speaker(session["agent_config"])

        if not session.get("tts_client"):
            session["tts_client"] = SarvamRealtimeTTS(language=session["language"], speaker=speaker)
            await session["tts_client"].connect()
            
        tts = session["tts_client"]
        
        response_text = ""
        sentence_buffer = ""
        import re
        sentence_end_pattern = re.compile(r'[.!?।॥]')
        
        current_date = time.strftime("%A, %B %d, %Y")
        company_name = session["company_name"]
        
        # Async generator for LLM stream
        async for token in llm_client.stream(
            user_message=transcript,
            conversation_history=session["conversation_history"],
            context_docs=context_docs,
            language=session["language"],
            current_date=current_date,
            company_name=company_name
        ):
            response_text += token
            sentence_buffer += token
            
            if sentence_end_pattern.search(sentence_buffer) and len(sentence_buffer) >= 15:
                sentence_to_speak = sentence_buffer.strip()
                sentence_buffer = ""
                
                # Clean hallucinated prefixes
                if sentence_to_speak.lower().startswith(('user:', 'உசர்:', 'பயனர்:')):
                    continue
                if sentence_to_speak.lower().startswith('assistant:'):
                    sentence_to_speak = sentence_to_speak.split(':', 1)[1].strip()
                    
                normalized_text = normalize_text_for_tts(sentence_to_speak, session["language"])
                await tts.send_text(normalized_text + " ")
                await tts.flush()
                
                # Receive audio
                session["tts_api_calls"] += 1
                async for audio_chunk in tts.receive_stream():
                    mulaw_audio = mp3_to_mulaw(audio_chunk)
                    if mulaw_audio:
                        try:
                            await websocket.send_json({
                                "event": "media",
                                "streamSid": stream_sid,
                                "media": {"payload": audio_to_base64(mulaw_audio)}
                            })
                        except Exception:
                            break
                            
        # Flush remaining buffer
        if sentence_buffer.strip():
            sentence_to_speak = sentence_buffer.strip()
            if not sentence_to_speak.lower().startswith(('user:', 'உசர்:', 'பயனர்:')):
                if sentence_to_speak.lower().startswith('assistant:'):
                    sentence_to_speak = sentence_to_speak.split(':', 1)[1].strip()
                normalized_text = normalize_text_for_tts(sentence_to_speak, session["language"])
                await tts.send_text(normalized_text)
                await tts.flush()
                session["tts_api_calls"] += 1
                async for audio_chunk in tts.receive_stream():
                    mulaw_audio = mp3_to_mulaw(audio_chunk)
                    if mulaw_audio:
                        try:
                            await websocket.send_json({
                                "event": "media",
                                "streamSid": stream_sid,
                                "media": {"payload": audio_to_base64(mulaw_audio)}
                            })
                        except Exception:
                            break
                            
        # Send playback mark
        try:
            await websocket.send_json({
                "event": "mark",
                "streamSid": stream_sid,
                "mark": {"name": f"response_{int(time.time())}"}
            })
        except:
            pass
            
        session["is_speaking"] = False
        
        # Save assistant message
        await add_message(company_id, conversation_id, "assistant", response_text, session["language"])
        
        # Update history
        session["conversation_history"].append({"role": "user", "content": transcript})
        session["conversation_history"].append({"role": "assistant", "content": response_text})
        
        if should_end_call_after_response(response_text, transcript, session):
            session["call_ended"] = True
            
    except Exception as e:
        logger.error(f"Voice pipeline error: {e}")
        session["is_speaking"] = False


# ── 4. WebSocket Media Stream ─────────────────────────────────────────────────

@router.websocket("/webhook/twilio/media-stream")
async def media_stream_websocket(websocket: WebSocket):
    """
    Main entrypoint for the Twilio media stream.
    Loads tenant config based on the Twilio phone number dialed.
    """
    from core.config import settings
    if settings.is_production and not settings.twilio_auth_token:
        await websocket.close(code=1008, reason="Twilio media authentication is not configured")
        return
    if settings.twilio_auth_token:
        signature = websocket.headers.get("X-Twilio-Signature", "")
        if not signature and not settings.is_production:
            logger.warning("Twilio media stream arrived without X-Twilio-Signature; allowing in development")
        elif not signature:
            logger.error(
                "[TWILIO_WS_REJECTED] reason=missing_signature host=%s path=%s",
                websocket.headers.get("host", ""),
                websocket.url.path,
            )
            await websocket.close(code=1008, reason="Missing Twilio media signature")
            return
        else:
            ws_url = str(websocket.url)
            # Render may omit x-forwarded-host while preserving the public
            # hostname in Host. Using the internal socket host here makes the
            # Twilio signature fail before the WebSocket is accepted.
            forwarded_host = websocket.headers.get("x-forwarded-host") or websocket.headers.get("host", "")
            forwarded_proto = websocket.headers.get("x-forwarded-proto")
            if forwarded_host:
                # Render terminates TLS before forwarding the WebSocket request.
                # Its proxy therefore reports https/http even though Twilio
                # signed the public endpoint as wss/ws. Validate against the
                # externally visible WebSocket scheme, not the proxy scheme.
                ws_url = _twilio_websocket_external_url(
                    str(websocket.url), forwarded_host, forwarded_proto
                )
            from twilio.request_validator import RequestValidator
            validator = RequestValidator(settings.twilio_auth_token)
            if not validator.validate(ws_url, dict(websocket.query_params), signature):
                logger.error(
                    "[TWILIO_WS_REJECTED] reason=invalid_signature host=%s forwarded_host=%s "
                    "forwarded_proto=%s validation_url=%s",
                    websocket.headers.get("host", ""),
                    forwarded_host or "",
                    forwarded_proto or "",
                    ws_url,
                )
                await websocket.close(code=1008, reason="Invalid Twilio media signature")
                return

    logger.info(
        "[TWILIO_WS_ACCEPTING] host=%s path=%s",
        websocket.headers.get("host", ""),
        websocket.url.path,
    )
    await websocket.accept()
    logger.info("[TWILIO_WS_ACCEPTED] path=%s", websocket.url.path)
    
    session = {
        "call_sid": "",
        "stream_sid": "",
        "caller": "",
        "called_number": "",
        "audio_buffer": AudioBuffer(target_duration_ms=40),
        "silence_detector": SilenceDetector(threshold=250, silence_duration_ms=800, min_speech_duration_ms=800),
        "is_speaking": False,
        "call_ended": False,
        "start_time": time.time(),
        "conversation_history": [],
        "rag_queries": 0,
        "stt_api_calls": 0,
        "tts_api_calls": 0,
        "llm_api_calls": 0,
        
        # Multi-tenant state (loaded on 'start' event)
        "company_id": None,
        "company_name": None,
        "agent_id": None,
        "conversation_id": None,
        "agent_config": None,
        "language": "en-IN",  # Default, overridden by agent config
        "llm_client": None,
        "rag_pipeline": None,
        "streaming_stt": None,
        "tts_client": None,
        # Do not inject ambience into production calls by default.  It was the
        # source of the user's reported buzzing/TV-like background noise.
        "enable_background_audio": False,
        "accumulated_audio": b"",
        "native_managed": False,
    }
    
    bg_audio_task = None
    
    try:
        while not session["call_ended"]:
            message = await websocket.receive_text()
            data = json.loads(message)
            event_type = data.get("event")
            
            if event_type == "start":
                # 1. Initialize call details
                start_data = data.get("start", {})
                session["call_sid"] = start_data.get("callSid", "")
                session["stream_sid"] = start_data.get("streamSid", "")
                
                # Twilio doesn't send To/From in the 'start' event of a media stream
                # unless explicitly added as custom parameters in TwiML.
                # For this integration, we parse them from custom parameters.
                custom_params = start_data.get("customParameters", {})
                phone_number = custom_params.get("called_number")
                caller = custom_params.get("caller")
                call_direction = str(custom_params.get("direction") or "inbound").lower()
                skip_greeting = str(custom_params.get("skip_greeting") or "").lower() == "true"
                
                # If custom parameters aren't provided, we have to look up the CallSid
                # in the conversation DB to find the number, assuming the HTTP webhook 
                # created the conversation first. But let's create the conversation here 
                # using the phone_number we get.
                
                # In this demo, we'll assume the webhook passed them in custom parameters, 
                # OR we look up the CallSid from the Conversation we created in the HTTP webhook.
                from services.conversation_service import find_conversation_by_call_sid
                
                # First attempt: load agent using the dialed phone number
                agent_context = None
                if phone_number:
                    agent_context = await load_agent_for_call(phone_number)

                # A few older TwiML configurations did not send custom
                # parameters. Recover those already-created outbound calls by
                # their CallSid so an answered call still gets its greeting.
                if not agent_context and session["call_sid"]:
                    previous = await col_conversations().find_one({"call_sid": session["call_sid"]})
                    fallback_number = str((previous or {}).get("caller_to") or "")
                    if fallback_number:
                        phone_number = fallback_number
                        caller = caller or str((previous or {}).get("caller_phone") or "")
                        agent_context = await load_agent_for_call(fallback_number)
                
                # Fallback: if we didn't get phone_number, try to find a recently created 
                # conversation by call_sid, or default to the first active channel if dev mode.
                if not agent_context and not settings.is_production:
                    # Local-only fallback for provider emulators.
                    from core.database import col_channels
                    channel = await col_channels().find_one({"is_active": True})
                    if channel:
                        agent_context = await load_agent_for_call(channel["phone_number"])
                
                if not agent_context:
                    logger.error(f"Could not resolve agent for call {session['call_sid']}")
                    await websocket.close()
                    return
                    
                # 2. Check Plan Limits
                if not await check_call_minute_limit(agent_context["company_id"]):
                    logger.warning(f"Company {agent_context['company_id']} exceeded call minute limit")
                    await websocket.close()
                    return

                if not await check_ai_credit_limit(agent_context["company_id"]):
                    logger.warning(f"Company {agent_context['company_id']} exceeded AI credit limit")
                    await websocket.close()
                    return
                    
                # 3. Setup Multi-Tenant Context
                agent = agent_context["agent"]
                session["company_id"] = agent_context["company_id"]
                session["company_name"] = agent_context["company"]["name"]
                session["agent_id"] = str(agent["_id"])
                session["agent_config"] = agent
                session["language"] = agent.get("default_language", "en-IN")
                session["enable_background_audio"] = agent.get("enable_background_audio", False)
                
                # 4. Initialize Multi-Tenant Clients
                try:
                    routed_agent = dict(agent)
                    routed_agent["_runtime_surface"] = "phone_voice"
                    session["llm_client"] = await AgentLLMClient.create(routed_agent)
                except RuntimeError as e:
                    # This is already a WebSocket, so returning an HTTP template
                    # here leaves the carrier stream in an invalid state.
                    logger.error("[TWILIO] provider_setup_failed=%s", str(e))
                    session["call_ended"] = True
                    await websocket.close(code=1011, reason="Voice provider unavailable")
                    return
                session["rag_pipeline"] = get_rag_pipeline(agent_context["company_id"], agent)

                # Gemini Live S2S is a complete Twilio phone engine.  Route it
                # before the legacy STT/TTS loop so the call uses native
                # Gemini audio instead of accidentally falling through to the
                # old Sarvam pipeline.
                from services.provider_routing import stage_providers
                phone_stt_route = await stage_providers("phone_voice", "stt")
                if (
                    str(agent.get("voice_engine") or "pipeline").lower() == "gemini_live"
                    and phone_stt_route
                    and phone_stt_route[0] == "gemini_live"
                ):
                    from modules.gemini_twilio_live import handle_twilio_gemini_live_session

                    native_result = await handle_twilio_gemini_live_session(
                        websocket,
                        start_data=start_data,
                        agent_context=agent_context,
                        rag_pipeline=session["rag_pipeline"],
                    )
                    if native_result is not None:
                        session["native_managed"] = True
                        session["conversation_id"] = native_result.get("conversation_id")
                        session["call_ended"] = True
                        logger.info(
                            "[TWILIO_ROUTE] native_gemini_s2s=true conversation=%s",
                            native_result.get("conversation_id"),
                        )
                        return
                    logger.warning("[TWILIO_ROUTE] native_gemini_unavailable fallback=classic_pipeline")
                
                # 5. Create Conversation Record
                conv = None
                if session["call_sid"]:
                    for _ in range(5):
                        conv = await col_conversations().find_one({"call_sid": session["call_sid"]})
                        if conv:
                            break
                        await asyncio.sleep(0.2)
                if not conv:
                    conv = await create_conversation(
                        company_id=session["company_id"],
                        agent_id=session["agent_id"],
                        channel_id=str(agent_context["channel"]["_id"]),
                        call_sid=session["call_sid"],
                        caller_phone=caller,
                        direction=call_direction,
                        language=session["language"]
                    )
                else:
                    await col_conversations().update_one(
                        {"_id": conv["_id"]},
                        {"$set": {
                            "company_id": session["company_id"],
                            "agent_id": session["agent_id"],
                            "channel_id": str(agent_context["channel"]["_id"]),
                            "direction": call_direction,
                            "answered_at": datetime.now(timezone.utc),
                            "status": "in-progress",
                        }},
                    )
                    conv = await col_conversations().find_one({"_id": conv["_id"]})
                session["conversation_id"] = str(conv["_id"])
                
                logger.info(f"✅ Call started. Tenant: {session['company_name']}, Agent: {agent['name']}")
                
                # 6. Initialize STT
                session["streaming_stt"] = TrueStreamingSTT(
                    language=session["language"],
                    model="saaras:v2"
                )
                await session["streaming_stt"].connect()
                
                # 7. Start Background Audio
                bg_audio_task = asyncio.create_task(
                    start_background_audio_loop(websocket, session["stream_sid"], session)
                )
                
                # 8. Send Greeting
                def normalize_text_for_tts(text: str, language: str) -> str: return text
                workspace_settings = agent_context["company"].get("settings", {})
                greeting = (
                    workspace_settings.get("inbound_greeting")
                    or agent.get("greeting_messages", {}).get(session["language"], DEFAULT_PHONE_WELCOME)
                )
                greeting = greeting.format(company_name=session["company_name"])

                if skip_greeting:
                    await add_message(session["company_id"], session["conversation_id"], "assistant", greeting, session["language"])
                    session["conversation_history"].append({"role": "assistant", "content": greeting})
                    session["is_speaking"] = False
                    continue
                
                session["is_speaking"] = True
                
                # We use Sarvam TTS directly for the greeting
                speaker = _sarvam_tts_speaker(agent)
                session["tts_client"] = SarvamRealtimeTTS(language=session["language"], speaker=speaker)
                await session["tts_client"].connect()
                
                normalized_greeting = normalize_text_for_tts(greeting, session["language"])
                await session["tts_client"].send_text(normalized_greeting)
                await session["tts_client"].flush()
                
                async for audio_chunk in session["tts_client"].receive_stream():
                    mulaw_audio = mp3_to_mulaw(audio_chunk)
                    if mulaw_audio:
                        await websocket.send_json({
                            "event": "media",
                            "streamSid": session["stream_sid"],
                            "media": {"payload": audio_to_base64(mulaw_audio)}
                        })
                
                await websocket.send_json({
                    "event": "mark",
                    "streamSid": session["stream_sid"],
                    "mark": {"name": f"greeting_done"}
                })
                
                session["is_speaking"] = False
                await add_message(session["company_id"], session["conversation_id"], "assistant", greeting, session["language"])
                session["conversation_history"].append({"role": "assistant", "content": greeting})
                
            elif event_type == "media":
                if session["is_speaking"]:
                    continue # Ignore audio while agent is speaking
                    
                payload = data["media"]["payload"]
                audio_chunk = base64.b64decode(payload)
                session["audio_buffer"].add_audio(audio_chunk)
                
                while session["audio_buffer"].has_chunk():
                    chunk = session["audio_buffer"].get_chunk()
                    session["accumulated_audio"] += chunk
                    
                    speech_state = session["silence_detector"].process_audio_chunk(chunk)
                    
                    if speech_state == "SPEECH_STARTED":
                        pass
                    elif speech_state == "SPEECH_ENDED":
                        audio_to_process = session["accumulated_audio"]
                        session["accumulated_audio"] = b""
                        
                        # Send to STT
                        if session["streaming_stt"] and len(audio_to_process) > 8000: # at least 1s
                            session["stt_api_calls"] += 1
                            result = await session["streaming_stt"].process_audio_chunk(audio_to_process, is_final=True)
                            if result and result.transcript:
                                # Process the turn
                                asyncio.create_task(
                                    process_voice_turn(websocket, session["stream_sid"], session, result.transcript)
                                )
                                
            elif event_type == "mark":
                # Used to know when playback finishes
                session["is_speaking"] = False
                
            elif event_type == "stop":
                session["call_ended"] = True
                break
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        session["call_ended"] = True
        
        # Cleanup tasks
        if bg_audio_task:
            bg_audio_task.cancel()
            
        # Close STT/TTS
        if session.get("streaming_stt"):
            try:
                await session["streaming_stt"].close()
            except Exception as exc:
                logger.debug("Twilio STT cleanup skipped: %s", type(exc).__name__)
        if session.get("tts_client"):
            try:
                await session["tts_client"].close()
            except Exception as exc:
                logger.debug("Twilio TTS cleanup skipped: %s", type(exc).__name__)
        if session.get("llm_client"):
            try:
                await session["llm_client"].close()
            except Exception as exc:
                logger.debug("Twilio LLM cleanup skipped: %s", type(exc).__name__)
            
        # Update Usage & Conversation
        if session.get("company_id") and session.get("conversation_id") and not session.get("native_managed"):
            duration = time.time() - session["start_time"]
            try:
                await end_conversation(
                    company_id=session["company_id"],
                    conversation_id=session["conversation_id"],
                    status="completed"
                )
                await increment_usage(
                    company_id=session["company_id"],
                    call_duration_seconds=duration,
                    stt_calls=session["stt_api_calls"],
                    tts_calls=session["tts_api_calls"],
                    rag_queries=session["rag_queries"],
                    direction="inbound"
                )
            except Exception as exc:
                logger.error("Twilio conversation cleanup failed: %s", type(exc).__name__)
        
        logger.info(f"Call ended for session {session.get('call_sid')}")
