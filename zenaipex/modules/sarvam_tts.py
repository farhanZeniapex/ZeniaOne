"""
Sarvam AI Text-to-Speech (TTS) Module
=====================================
Real-time TTS using Sarvam SDK.
Outputs MP3 which is converted to mulaw for Twilio.
"""
import asyncio
import base64
import time
from typing import Optional, List
from dataclasses import dataclass

from sarvamai import AsyncSarvamAI
try:
    from core.config import settings
    SARVAM_API_KEY = settings.sarvam_api_key
except Exception:
    try:
        import config
        SARVAM_API_KEY = getattr(config, "SARVAM_API_KEY", "")
    except Exception:
        import os
        SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")

try:
    from modules.sarvam_stt import SarvamRealtimeSTT  # Optional legacy STT helper
except ModuleNotFoundError:
    SarvamRealtimeSTT = None


@dataclass
class TTSChunk:
    """Audio chunk from real-time TTS"""
    audio_data: bytes
    is_final: bool
    latency_ms: Optional[float] = None


class SarvamRealtimeTTS:
    """
    Real-time Text-to-Speech using Sarvam SDK.
    Outputs MP3 which is then converted to mulaw for Twilio.
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        language: str = "en-IN",
        speaker: str = "ritu",
        model: str = "bulbul:v3"
    ):
        self.api_key = api_key or SARVAM_API_KEY
        self.language = language
        self.speaker = speaker
        self.model = model
        self.client: Optional[AsyncSarvamAI] = None
        self._ws_context = None
        self.ws = None
        self._configured = False
        self._start_time: Optional[float] = None
        
    async def connect(self, max_retries: int = 3, retry_delay: float = 1.0) -> bool:
        """Establish connection to Sarvam TTS with retry logic."""
        import logging
        logger = logging.getLogger(__name__)

        # Resolve MongoDB ObjectId to actual Sarvam voice_id if applicable
        self.speaker = await resolve_speaker(self.speaker)

        # Validate speaker compatibility
        if self.model == "bulbul:v3":
            supported_speakers = {"aditya", "ritu", "ashutosh", "priya", "neha", "rahul", "pooja", "rohan", "simran", "kavya", "amit", "dev", "ishita", "shreya", "ratan", "varun", "manan", "sumit", "roopa", "kabir", "aayan", "shubh", "advait", "anand", "tanya", "tarun", "sunny", "mani", "gokul", "vijay", "shruti", "suhani", "mohit", "kavitha", "rehan", "soham", "rupali"}
            if self.speaker not in supported_speakers and not self.speaker.startswith("svc-"):
                logger.error(f"[TTS_INVALID_SPEAKER] model={self.model} speaker={self.speaker}")
                raise ValueError(f"Speaker '{self.speaker}' is not compatible with model {self.model}.")

        for attempt in range(1, max_retries + 1):
            try:
                if attempt > 1:
                    logger.info(f"TTS connection retry {attempt}/{max_retries}...")
                else:
                    logger.info(f"Connecting to Sarvam TTS...")
                    
                self._start_time = time.perf_counter()
                
                self.client = AsyncSarvamAI(api_subscription_key=self.api_key)
                
                self._ws_context = self.client.text_to_speech_streaming.connect(
                    model=self.model,  # type: ignore
                    send_completion_event=True
                )
                
                # Add timeout for connection attempt
                self.ws = await asyncio.wait_for(
                    self._ws_context.__aenter__(),
                    timeout=5.0  # 5 second timeout for connection
                )
                
                connect_time = (time.perf_counter() - self._start_time) * 1000
                logger.info(f"Sarvam TTS connected in {connect_time:.0f}ms")
                
                # Send configuration
                await self._send_config()
                
                return True
                
            except (asyncio.TimeoutError, TimeoutError) as e:
                logger.warning(f"TTS connection timeout (attempt {attempt}/{max_retries})")
                await self._cleanup_connection()
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay)
                    
            except asyncio.CancelledError as e:
                logger.warning(f"TTS connection cancelled (attempt {attempt}/{max_retries})")
                await self._cleanup_connection()
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay)
                    
            except Exception as e:
                logger.error(f"Failed to connect to Sarvam TTS (attempt {attempt}/{max_retries}): {e}")
                import traceback
                traceback.print_exc()
                await self._cleanup_connection()
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay)
        
        logger.error(f"TTS connection failed after {max_retries} attempts")
        return False
    
    async def _cleanup_connection(self) -> None:
        """Clean up failed connection attempt."""
        try:
            if self._ws_context:
                await self._ws_context.__aexit__(None, None, None)
        except:
            pass
        self.ws = None
        self._ws_context = None
        self.client = None
        self._configured = False
    
    def is_connected(self) -> bool:
        """Check if the WebSocket connection is active."""
        return self.ws is not None and self._ws_context is not None
    
    async def ensure_connected(self) -> bool:
        """Ensure connection is alive, reconnect if needed. ⚡ For connection pooling."""
        if self.is_connected():
            return True
        return await self.connect(max_retries=2, retry_delay=0.3)
    
    async def reconfigure(self, language: str, speaker: str = "anushka") -> None:
        """Reconfigure TTS for new language without reconnecting. ⚡ Saves ~200ms."""
        self.language = language
        self.speaker = speaker
        if self.is_connected():
            await self._send_config()

    async def _send_config(self) -> None:
        """Send TTS configuration."""
        import logging
        logger = logging.getLogger(__name__)
        if not self.ws:
            return
        
        try:
            # Configure TTS - SDK outputs MP3 by default
            # We'll convert to mulaw for Twilio
            await self.ws.configure(
                target_language_code=self.language,
                speaker=self.speaker
            )
            self._configured = True
            logger.info(f"TTS configured: {self.language}, {self.speaker}")
        except Exception as e:
            logger.error(f"Error configuring TTS: {e}")
            import traceback
            traceback.print_exc()
    
    async def send_text(self, text: str) -> None:
        """Send text to be synthesized."""
        import logging
        logger = logging.getLogger(__name__)
        if not self.ws or not self._configured:
            logger.warning("TTS not connected or configured")
            return
        
        try:
            # Send text chunks
            logger.info(f"Sending {len(text)} chars to TTS...")
            await self.ws.convert(text)
        except Exception as e:
            logger.error(f"Error sending text to TTS: {e}")
    
    async def flush(self) -> None:
        """Send flush signal to indicate end of text."""
        import logging
        logger = logging.getLogger(__name__)
        if not self.ws:
            return
            
        try:
            await self.ws.flush()
            logger.info("TTS flush signal sent")
        except Exception as e:
            logger.error(f"Error sending flush: {e}")
    
    async def receive_all(self, max_wait: float = 10.0) -> List[bytes]:
        """
        Receive all audio chunks until completion.
        Returns list of raw audio bytes (mp3 format from SDK).
        """
        import logging
        logger = logging.getLogger(__name__)
        if not self.ws:
            return []
        
        audio_chunks = []
        chunk_count = 0
        
        try:
            logger.info("Receiving TTS audio chunks...")
            
            async for message in self.ws:
                msg_type = getattr(message, 'type', None)
                
                # Check for explicit error from server
                if msg_type == 'error':
                    error_msg = getattr(message.data, 'message', 'Unknown TTS Error') if hasattr(message, 'data') else 'Unknown TTS Error'
                    logger.error(f"[TTS_RECEIVE_ERROR] Server returned error: {error_msg}")
                    raise RuntimeError(f"Sarvam TTS Error: {error_msg}")
                    
                # Check if it's an AudioOutput object
                if hasattr(message, 'data') and hasattr(message.data, 'audio'):
                    audio_b64 = message.data.audio
                    audio_data = base64.b64decode(audio_b64)
                    audio_chunks.append(audio_data)
                    chunk_count += 1
                    logger.info(f"Audio chunk {chunk_count}: {len(audio_data)} bytes")
                
                # Check for completion event
                elif hasattr(message, 'data') and hasattr(message.data, 'event_type'):
                    if message.data.event_type == "final":
                        logger.info("TTS generation complete")
                        break
                
                # Handle dict responses
                elif isinstance(message, dict):
                    if message.get("type") == "error":
                        error_msg = message.get("data", {}).get("message", "Unknown TTS Error")
                        logger.error(f"[TTS_RECEIVE_ERROR] Server returned error: {error_msg}")
                        raise RuntimeError(f"Sarvam TTS Error: {error_msg}")
                    elif "audio" in message:
                        audio_data = base64.b64decode(message["audio"])
                        audio_chunks.append(audio_data)
                        chunk_count += 1
                    elif message.get("event_type") == "final" or message.get("type") == "event":
                        break
            
            logger.info(f"Total TTS chunks received: {chunk_count}")
            if chunk_count == 0:
                logger.warning("TTS completed but zero audio chunks were received.")
                
            return audio_chunks
            
        except Exception as e:
            logger.error(f"Error receiving TTS: {e}")
            raise  # Re-raise so the caller knows TTS failed
    
    async def receive_stream(self):
        """
        Yield audio chunks as they arrive from the WebSocket.
        """
        if not self.ws:
            return

        chunk_count = 0
        try:
            print("⏳ Streaming TTS audio chunks...")

            async for message in self.ws:
                # Check if it's an AudioOutput object
                if hasattr(message, 'data') and hasattr(message.data, 'audio'):
                    audio_b64 = message.data.audio
                    audio_data = base64.b64decode(audio_b64)
                    yield audio_data
                    chunk_count += 1

                # Check for completion event
                elif hasattr(message, 'data') and hasattr(message.data, 'event_type'):
                    if message.data.event_type == "final":
                        # print("✅ TTS generation complete")
                        break
                
                # Handle dict responses
                elif isinstance(message, dict):
                    if "audio" in message:
                        audio_data = base64.b64decode(message["audio"])
                        yield audio_data
                        chunk_count += 1
                    elif message.get("event_type") == "final":
                        break
            
            print(f"📊 Total streaming TTS chunks received: {chunk_count}")

        except Exception as e:
            print(f"❌ Error receiving TTS stream: {e}")
            import traceback
            traceback.print_exc()

    async def ping(self) -> bool:
        """Send ping to keep connection alive. Returns True if connection is healthy."""
        if not self.ws:
            return False
        try:
            # Sarvam TTS supports ping signal
            await self.ws.ping()
            return True
        except Exception as e:
            print(f"⚠️ TTS ping failed: {e}")
            return False
    
    async def reset_for_stream(self) -> None:
        """Reset state for a new TTS stream without disconnecting. ⚡ Saves ~1s per turn."""
        self._start_time = time.perf_counter()
        # Connection stays open, just reset timing
        # No need to reconfigure unless language changes

    async def disconnect(self) -> None:
        """Close connection."""
        if self._ws_context:
            try:
                await self._ws_context.__aexit__(None, None, None)
                print("🔌 Sarvam TTS disconnected")
            except:
                pass
        self.ws = None
        self._ws_context = None
        self.client = None
        self._configured = False


# Global connection pools
_stt_pool = {}
_tts_pool = {}

async def _get_pooled_stt(language: str, max_retries: int) -> Optional[SarvamRealtimeSTT]:
    if SarvamRealtimeSTT is None:
        raise RuntimeError("SarvamRealtimeSTT is not installed in this backend package")
    pool_key = language
    stt = _stt_pool.get(pool_key)
    if stt and stt.is_connected():
        await stt.reset_for_new_turn()
        return stt
    
    stt = SarvamRealtimeSTT(language=language)
    if not await stt.connect(max_retries=max_retries):
        return None
    _stt_pool[pool_key] = stt
    return stt

async def realtime_stt(audio_data: bytes, language: str = "hi-IN", max_retries: int = 3, encoding: str = "audio/wav") -> str:
    """Convenience function for a single voice turn with connection pooling."""
    stt = await _get_pooled_stt(language, max_retries)
    if not stt:
        return ""
    try:
        await stt.send_audio(audio_data, encoding=encoding)
        await stt.flush()
        result = await stt.receive()
        return result.transcript if result else ""
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Pooled STT error: {e}")
        await stt.disconnect()
        _stt_pool.pop(language, None)
        return ""

# Circuit breaker to eliminate multiple-second retry delays when Sarvam credits are exhausted
_SARVAM_CIRCUIT_BROKEN = False
_SARVAM_LAST_FAILURE_TIME = 0.0

def mark_sarvam_failed(reason: str = "Credits exhausted"):
    global _SARVAM_CIRCUIT_BROKEN, _SARVAM_LAST_FAILURE_TIME
    _SARVAM_CIRCUIT_BROKEN = True
    _SARVAM_LAST_FAILURE_TIME = time.time()
    import logging
    logging.getLogger(__name__).warning(f"[SARVAM_CIRCUIT_BREAKER] Activated ({reason}). Bypassing Sarvam to achieve instant ~200ms neural speech.")

def is_sarvam_available() -> bool:
    global _SARVAM_CIRCUIT_BROKEN, _SARVAM_LAST_FAILURE_TIME
    if not _SARVAM_CIRCUIT_BROKEN:
        return True
    # Auto-retry after 5 minutes in case credits were added
    if time.time() - _SARVAM_LAST_FAILURE_TIME > 300:
        _SARVAM_CIRCUIT_BROKEN = False
        return True
    return False

async def _acquire_tts(language: str, speaker: str) -> Optional['SarvamRealtimeTTS']:
    import logging
    logger = logging.getLogger(__name__)
    if not is_sarvam_available():
        return None
    pool_key = f"{language}_{speaker}"
    
    tts = _tts_pool.pop(pool_key, None)
    
    if tts and tts.is_connected():
        logger.info(f"[VOICE_TTS_POOL_REUSE] key={pool_key}")
        await tts.reset_for_stream()
        return tts
    
    if tts:
        await tts.disconnect()
        
    logger.info(f"[VOICE_TTS_POOL_CREATE] key={pool_key}")
    tts = SarvamRealtimeTTS(language=language, speaker=speaker)
    if not await tts.connect():
        logger.error(f"[VOICE_TTS_POOL_ERROR] key={pool_key}")
        return None
    return tts

def _release_tts(language: str, speaker: str, tts: 'SarvamRealtimeTTS'):
    if tts and tts.is_connected():
        _tts_pool[f"{language}_{speaker}"] = tts

PERSONA_TO_EDGE_VOICE = {
    # Female voices (distinct neural models & acoustic tuning)
    "ritu": {"voice": "hi-IN-SwaraNeural", "rate": "+20%", "pitch": "+0Hz"},
    "priya": {"voice": "en-IN-NeerjaExpressiveNeural", "rate": "+20%", "pitch": "+0Hz"},
    "neha": {"voice": "en-IN-NeerjaNeural", "rate": "+32%", "pitch": "-4Hz"},
    "pooja": {"voice": "en-US-JennyNeural", "rate": "+30%", "pitch": "+12Hz"},
    "shreya": {"voice": "en-US-AriaNeural", "rate": "+22%", "pitch": "+4Hz"},
    "kavya": {"voice": "en-GB-SoniaNeural", "rate": "+15%", "pitch": "-4Hz"},

    # Male voices (distinct neural models & acoustic tuning)
    "rahul": {"voice": "en-IN-PrabhatNeural", "rate": "+20%", "pitch": "+0Hz"},
    "amit": {"voice": "hi-IN-MadhurNeural", "rate": "+16%", "pitch": "-6Hz"},
    "rohan": {"voice": "en-US-GuyNeural", "rate": "+32%", "pitch": "+4Hz"},
    "kabir": {"voice": "en-US-BrianNeural", "rate": "+10%", "pitch": "-14Hz"},
    "aditya": {"voice": "en-US-ChristopherNeural", "rate": "+20%", "pitch": "-6Hz"},
}

async def resolve_speaker(speaker: str) -> str:
    """Resolve MongoDB ObjectId to actual Sarvam voice_id if applicable."""
    if not speaker or len(speaker) != 24:
        return speaker
    try:
        from core.database import col_custom_voices
        from bson import ObjectId
        cv = await col_custom_voices().find_one({"_id": ObjectId(speaker)})
        if cv and "voice_id" in cv:
            return cv["voice_id"]
    except Exception:
        pass
    return speaker


async def cloned_voice_tts_stream(
    text: str,
    voice_id: str,
    language: str = "hi-IN",
    sample_rate: int = 8000,
    pace: float = 1.0,
):
    """Yield raw LINEAR16 audio from Sarvam's cloned-voice HTTP stream.

    The endpoint returns binary audio progressively. Requesting 8 kHz LINEAR16
    lets the Exotel path forward audio without MP3 decoding or resampling.
    """
    import aiohttp

    resolved_voice = await resolve_speaker(voice_id)
    if not resolved_voice or not resolved_voice.startswith("svc-"):
        raise ValueError("A saved Sarvam cloned voice ID is required")

    try:
        from core.config import settings
    except ImportError:
        from zenaipex.core.config import settings

    api_key = getattr(settings, "sarvam_api_key", "")
    if not api_key:
        raise RuntimeError("Sarvam API key is not configured")

    form = aiohttp.FormData()
    form.add_field("voice_id", resolved_voice)
    form.add_field("text", text[:1000])
    form.add_field("language_code", language)
    form.add_field("pace", str(max(0.5, min(2.0, pace))))
    form.add_field("output_audio_codec", "linear16")
    form.add_field("speech_sample_rate", str(sample_rate))

    timeout = aiohttp.ClientTimeout(total=20, connect=5, sock_read=15)
    headers = {"api-subscription-key": api_key}
    url = "https://api.sarvam.ai/voices/clone/stream"
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, headers=headers, data=form) as response:
            if response.status != 200:
                body = (await response.text())[:500]
                raise RuntimeError(f"Sarvam clone stream failed ({response.status}): {body}")
            async for chunk in response.content.iter_chunked(4096):
                if chunk:
                    yield bytes(chunk)

async def fallback_neural_tts(text: str, speaker: str = "ritu", speed: float = 1.0, volume: float = 1.0) -> bytes:
    """Fallback neural synthesis for each persona using high-fidelity edge_tts, or Sarvam Cloned voice, applying speed and volume."""
    import logging
    logger = logging.getLogger(__name__)
    
    speaker = await resolve_speaker(speaker)
    
    # Check if this is a custom Sarvam cloned voice
    if speaker and speaker.startswith("svc-"):
        try:
            import aiohttp
            import base64
            try:
                from core.config import settings
                api_key = settings.sarvam_api_key
            except ImportError:
                try:
                    from zenaipex.core.config import settings
                    api_key = settings.sarvam_api_key
                except ImportError:
                    import config
                    api_key = getattr(config, "SARVAM_API_KEY", "")

            try:
                from zenaipex.modules.audio_utils import apply_audio_tuning
            except ImportError:
                from modules.audio_utils import apply_audio_tuning

            logger.info(f"[TTS_CUSTOM_CLONE] Calling Sarvam REST for speaker={speaker} speed={speed} volume={volume}")
            url = "https://api.sarvam.ai/voices/clone"
            headers = {"api-subscription-key": api_key}
            data = {"voice_id": speaker, "text": text, "language_code": "hi-IN"}
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, data=data) as response:
                    if response.status in (200, 201):
                        res_data = await response.json()
                        audio_b64 = res_data.get("audio", "")
                        if audio_b64:
                            raw_wav = base64.b64decode(audio_b64)
                            return apply_audio_tuning(raw_wav, spd=speed, vol=volume, output_format="mp3")
                    else:
                        logger.error(f"[TTS_CUSTOM_CLONE_ERR] status={response.status} {await response.text()}")
        except Exception as e:
            logger.error(f"[TTS_CUSTOM_CLONE_EXCEPTION] {e}")

    try:
        import edge_tts
        from modules.audio_utils import apply_audio_tuning
        speaker_key = (speaker or "ritu").lower()
        cfg = PERSONA_TO_EDGE_VOICE.get(speaker_key, PERSONA_TO_EDGE_VOICE["ritu"])
        rate_str = cfg["rate"]
        if abs(speed - 1.0) > 0.02:
            pct = int((speed - 1.0) * 100)
            rate_str = f"{'+' if pct >= 0 else ''}{pct}%"
        communicate = edge_tts.Communicate(text, cfg["voice"], rate=rate_str, pitch=cfg["pitch"])
        audio_data = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.extend(chunk["data"])
        if audio_data:
            logger.info(f"[TTS_NEURAL_FALLBACK] Synthesized {len(audio_data)} bytes for speaker={speaker_key} voice={cfg['voice']} (speed={speed} volume={volume})")
            raw_res = bytes(audio_data)
            return apply_audio_tuning(raw_res, spd=speed, vol=volume, output_format="mp3")
    except Exception as e:
        logger.error(f"[TTS_NEURAL_FALLBACK_ERROR] {e}")
    return b""

async def realtime_tts(
    text: str,
    language: str = "en-IN",
    speaker: str = "ritu"
) -> bytes:
    """Synthesize speech - returns raw audio (mp3) with connection pooling and neural fallback."""
    import logging
    logger = logging.getLogger(__name__)
    
    speaker = await resolve_speaker(speaker)
    
    # Sarvam real-time TTS stream does not support cloned voices, go directly to fallback REST API
    if speaker and speaker.startswith("svc-"):
        return await fallback_neural_tts(text, speaker)

    pool_key = f"{language}_{speaker}"
    
    if not is_sarvam_available():
        return await fallback_neural_tts(text, speaker)

    for attempt in range(2):
        tts = await _acquire_tts(language, speaker)
        if not tts:
            if attempt == 1:
                logger.info(f"[VOICE_TTS_SARVAM_OFFLINE] Using neural fallback for speaker={speaker}")
                return await fallback_neural_tts(text, speaker)
            continue
            
        try:
            await tts.send_text(text)
            await tts.flush()
            chunks = await tts.receive_all()
            _release_tts(language, speaker, tts)
            audio = b"".join(chunks)
            if audio and len(audio) > 200:
                if attempt == 1:
                    logger.info(f"[VOICE_TTS_POOL_RECOVERY_SUCCESS] key={pool_key}")
                return audio
            else:
                logger.info(f"[VOICE_TTS_EMPTY_SARVAM] Empty chunks returned, using neural fallback for speaker={speaker}")
                mark_sarvam_failed("Empty chunks from Sarvam")
                return await fallback_neural_tts(text, speaker)
        except Exception as e:
            logger.warning(f"Pooled TTS error (attempt {attempt+1}): {e}")
            await tts.disconnect()
            if attempt == 0:
                logger.info(f"[VOICE_TTS_POOL_STALE] key={pool_key}")
                logger.info(f"[VOICE_TTS_POOL_RECREATE] Retrying request")
            else:
                logger.info(f"[VOICE_TTS_SARVAM_FAILED] Using neural fallback for speaker={speaker}")
                mark_sarvam_failed(f"Sarvam error: {e}")
                return await fallback_neural_tts(text, speaker)
                
    return await fallback_neural_tts(text, speaker)

async def realtime_tts_stream(
    text: str,
    language: str = "en-IN",
    speaker: str = "ritu",
    pace: float = 1.0,
):
    """Synthesize speech - yields raw audio chunks (linear16 24kHz) with connection pooling."""
    import logging
    logger = logging.getLogger(__name__)
    
    speaker = await resolve_speaker(speaker)
    
    if speaker and speaker.startswith("svc-"):
        # A clone must use Sarvam's clone stream. Returning without yielding
        # silently produced no audio in browser voice chat and call sessions.
        logger.info("[TTS_CLONE_STREAM] provider=sarvam_clone speaker=%s", speaker)
        clone_kwargs = {
            "text": text,
            "voice_id": speaker,
            "language": language,
            "sample_rate": 24000,
        }
        if pace != 1.0:
            clone_kwargs["pace"] = pace
        async for chunk in cloned_voice_tts_stream(**clone_kwargs):
            yield chunk
        return

    pool_key = f"{language}_{speaker}"
    
    if not is_sarvam_available():
        return
        
    for attempt in range(2):
        tts = await _acquire_tts(language, speaker)
        if not tts:
            if attempt == 1:
                logger.error(f"[VOICE_TTS_POOL_RECOVERY_FAILED] key={pool_key}")
            return
            
        chunks_yielded = 0
        try:
            # Reconfigure for linear16 streaming
            await tts.ws.configure(  # type: ignore
                target_language_code=language,
                speaker=speaker,
                output_audio_codec="linear16",
                speech_sample_rate=24000
            )
            
            await tts.send_text(text)
            await tts.flush()
            
            async for chunk in tts.receive_stream():
                yield chunk
                chunks_yielded += 1
                
            _release_tts(language, speaker, tts)
            if chunks_yielded == 0:
                mark_sarvam_failed("Sarvam stream returned 0 chunks")
                return
            if attempt == 1:
                logger.info(f"[VOICE_TTS_POOL_RECOVERY_SUCCESS] key={pool_key}")
            return
                
        except Exception as e:
            logger.warning(f"Pooled TTS stream error (attempt {attempt+1}): {e}")
            await tts.disconnect()
            if chunks_yielded > 0:
                logger.error(f"[VOICE_TTS_POOL_RECOVERY_FAILED] key={pool_key} - Cannot retry, partial audio emitted")
                return
            if attempt == 0:
                logger.info(f"[VOICE_TTS_POOL_STALE] key={pool_key}")
                logger.info(f"[VOICE_TTS_POOL_RECREATE] Retrying request")
            else:
                logger.error(f"[VOICE_TTS_POOL_RECOVERY_FAILED] key={pool_key}")
                return
_FALLBACK_TTS_CACHE = {}

async def stream_fallback_neural_tts(text: str, speaker: str = "hi-IN-SwaraNeural", speed: float = 1.15, volume: float = 1.35):
    """
    Streams EdgeTTS MP3 output into FFmpeg to yield 8kHz 16-bit Mono PCM chunks
    instantly, without waiting for the full MP3 to buffer, applying speed & volume.
    """
    import io, tempfile, asyncio
    import time
    import logging
    logger = logging.getLogger(__name__)
    try:
        cache_key = f"{speaker}_{speed}_{volume}_{text}"
        if cache_key in _FALLBACK_TTS_CACHE:
            logger.info(f"[TTS_CACHE_HIT] Streaming from cache for {speaker}")
            for cached_chunk in _FALLBACK_TTS_CACHE[cache_key]:
                yield cached_chunk
                await asyncio.sleep(0.01) # Simulate real-time streaming
            return

        if speaker.startswith("svc-"):
            import aiohttp
            import base64
            from core.config import settings
            from modules.audio_utils import convert_to_exotel_pcm
            logger.info(f"[TTS_STREAM_CLONE] Calling Sarvam REST for speaker={speaker} speed={speed} volume={volume}")
            url = "https://api.sarvam.ai/voices/clone"
            headers = {"api-subscription-key": settings.sarvam_api_key}
            data = {"voice_id": speaker, "text": text, "language_code": "hi-IN"}
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, data=data) as response:
                    if response.status in (200, 201):
                        res_data = await response.json()
                        audio_b64 = res_data.get("audio", "")
                        if audio_b64:
                            raw_wav = base64.b64decode(audio_b64)
                            pcm_8k = convert_to_exotel_pcm(raw_wav, speed=speed, volume=volume)
                            chunk_size = 1600 # 100ms at 8000Hz 16-bit
                            cached_chunks = []
                            for i in range(0, len(pcm_8k), chunk_size):
                                c = pcm_8k[i:i+chunk_size]
                                cached_chunks.append(c)
                                yield c
                            if cached_chunks:
                                _FALLBACK_TTS_CACHE[cache_key] = cached_chunks
                            return
                    else:
                        logger.error(f"[TTS_STREAM_CLONE_ERR] {response.status} {await response.text()}")
            # If clone failed, fall through to EdgeTTS below with a safe natural voice
            speaker = "hi-IN-MadhurNeural"

        # Launch ffmpeg process to convert EdgeTTS MP3 to 8kHz 16-bit mono PCM on the fly
        import shutil
        import subprocess
        import os
        ffmpeg_cmd = shutil.which("ffmpeg")
        if not ffmpeg_cmd:
            ffmpeg_cmd = r"C:\Users\kures\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
            
        process = subprocess.Popen(
            [ffmpeg_cmd, '-i', 'pipe:0', '-f', 's16le', '-ar', '8000', '-ac', '1', 'pipe:1', '-loglevel', 'quiet'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )

        async def write_to_ffmpeg():
            try:
                import edge_tts
                edge_voice = speaker if not speaker.startswith("svc-") else "hi-IN-MadhurNeural"
                rate_pct = int((speed - 1.0) * 100) if abs(speed - 1.0) > 0.02 else 20
                rate_str = f"{'+' if rate_pct >= 0 else ''}{rate_pct}%"
                communicate = edge_tts.Communicate(text, edge_voice, rate=rate_str)
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio" and process.stdin is not None:
                        def _write(data):
                            process.stdin.write(data)
                            process.stdin.flush()
                        await asyncio.to_thread(_write, chunk["data"])
            except Exception as e:
                logger.error(f"[TTS_STREAM] Write error: {e}")
            finally:
                if process.stdin:
                    try:
                        process.stdin.close()
                    except:
                        pass

        # Start the writer task
        writer_task = asyncio.create_task(write_to_ffmpeg())
        
        # Read PCM chunks as they become available
        chunk_size = 1600 # 100ms at 8000Hz 16-bit
        cached_chunks = []
        try:
            while True:
                if process.stdout is not None:
                    pcm_chunk = await asyncio.to_thread(process.stdout.read, chunk_size)
                    if not pcm_chunk:
                        break
                    cached_chunks.append(pcm_chunk)
                    yield pcm_chunk
                else:
                    break
            
            # Save to cache if successful
            if cached_chunks and len(cached_chunks) > 0:
                _FALLBACK_TTS_CACHE[cache_key] = cached_chunks
                
        except asyncio.CancelledError:
            logger.info("🛑 [TTS_STREAM] Cancelled, stopping ffmpeg")
            process.kill()
            writer_task.cancel()
            raise
        finally:
            try:
                if process.poll() is None:
                    process.kill()
            except:
                pass
            writer_task.cancel()

    except Exception as e:
        logger.error(f"[TTS_NEURAL_FALLBACK_ERROR] {e}")


