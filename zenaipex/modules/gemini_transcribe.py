"""Gemini Live Transcribe adapter for 8 kHz telephone PCM audio."""

from __future__ import annotations

import audioop
import base64
import json
import logging
from typing import Any, Dict, Optional
from urllib.parse import quote

import websockets

logger = logging.getLogger(__name__)

GEMINI_TRANSCRIBE_MODEL = "gemini-3.5-transcribe-live"
GEMINI_LIVE_URL = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)


async def resolve_gemini_api_key() -> str:
    """Read the enabled Gemini provider key using the existing encrypted store."""
    try:
        from services.provider_service import resolve_providers

        providers = await resolve_providers()
        for provider in providers:
            if provider.provider.lower() == "gemini" and provider.api_key:
                return str(provider.api_key).strip()
    except Exception as exc:
        logger.warning("[GEMINI_TRANSCRIBE] provider_key_lookup_failed=%s", type(exc).__name__)

    from core.config import settings

    return str(getattr(settings, "gemini_api_key", "") or "").strip()


class GeminiLiveTranscriber:
    """Expose Gemini transcription through the send/recv shape used by the call route."""

    provider_name = "gemini_live_transcribe"

    def __init__(self, websocket: Any, source_sample_rate: int = 8000):
        self.websocket = websocket
        self.source_sample_rate = source_sample_rate
        self._rate_state = None

    @classmethod
    async def connect(
        cls, api_key: str, *, source_sample_rate: int = 8000
    ) -> "GeminiLiveTranscriber":
        if not api_key:
            raise RuntimeError("Gemini API key is not configured")
        url = f"{GEMINI_LIVE_URL}?key={quote(api_key, safe='')}"
        websocket = await websockets.connect(url, max_size=4 * 1024 * 1024)
        if source_sample_rate not in {8000, 16000}:
            await websocket.close()
            raise ValueError("Gemini transcription supports 8 kHz or 16 kHz PCM input")
        adapter = cls(websocket, source_sample_rate=source_sample_rate)
        try:
            await websocket.send(json.dumps({
                "setup": {
                    "model": f"models/{GEMINI_TRANSCRIBE_MODEL}",
                    "generationConfig": {"responseModalities": ["TEXT"]},
                    "inputAudioTranscription": {
                        "languageCodes": [],
                        "customVocabulary": ["Zenia", "Zenia One", "Zenia HR", "OM"],
                        "mode": "VERBATIM",
                    },
                }
            }))
            setup_response = json.loads(await websocket.recv())
            if "setupComplete" not in setup_response and "setup_complete" not in setup_response:
                raise RuntimeError(f"Unexpected Gemini setup response: {list(setup_response.keys())}")
            logger.info("[GEMINI_TRANSCRIBE] connected model=%s", GEMINI_TRANSCRIBE_MODEL)
            return adapter
        except Exception:
            await websocket.close()
            raise

    async def send(self, pcm: bytes) -> None:
        """Send telephone 8 kHz or browser microphone 16 kHz PCM to Gemini."""
        if not pcm:
            return
        if self.source_sample_rate == 8000:
            pcm_16khz, self._rate_state = audioop.ratecv(
                pcm, 2, 1, 8000, 16000, self._rate_state
            )
        else:
            pcm_16khz = pcm
        await self.websocket.send(json.dumps({
            "realtimeInput": {
                "audio": {
                    "data": base64.b64encode(pcm_16khz).decode("ascii"),
                    "mimeType": "audio/pcm;rate=16000",
                }
            }
        }))

    async def recv(self) -> str:
        """Return a Deepgram-compatible result consumed by the existing turn logic."""
        while True:
            raw = await self.websocket.recv()
            response = json.loads(raw)
            content = response.get("serverContent") or response.get("server_content") or {}
            interim = content.get("interimInputTranscription") or content.get("interim_input_transcription")
            final = content.get("inputTranscription") or content.get("input_transcription")
            transcript_event: Optional[Dict[str, Any]] = final or interim
            if not transcript_event:
                continue
            text = str(transcript_event.get("text") or "").strip()
            if not text:
                continue
            return json.dumps({
                "type": "Results",
                "is_final": bool(final),
                "channel": {
                    "alternatives": [{
                        "transcript": text,
                        "confidence": 1.0,
                        "languages": [],
                    }]
                },
            })

    async def close(self) -> None:
        try:
            await self.websocket.send(json.dumps({
                "realtimeInput": {"audioStreamEnd": True}
            }))
        except Exception:
            pass
        await self.websocket.close()
