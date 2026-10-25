"""Runtime configuration and latency helpers for telephone voice calls."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import re
import time
from typing import Any, Dict, Optional


def _bounded_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _voice_label(value: Any) -> str:
    voice = str(value or "ritu")
    if len(voice) == 24 and all(char in "0123456789abcdefABCDEF" for char in voice):
        return "custom_clone"
    return voice


class VoiceSentenceSegmenter:
    """Split streamed LLM tokens into short, speakable clauses.

    The segmenter waits for punctuation, so Sarvam can begin synthesizing the
    first sentence while Gemini is still generating the next one.  A maximum
    character guard prevents a punctuation-free answer from delaying audio.
    """

    _BOUNDARY = re.compile(r"[.!?।\n]+(?:\s+|$)")

    def __init__(self, max_chars: int = 120):
        self.max_chars = max(48, int(max_chars))
        self.buffer = ""

    def push(self, token: str) -> list[str]:
        if token:
            self.buffer += token
        ready: list[str] = []

        while self.buffer:
            match = self._BOUNDARY.search(self.buffer)
            if match:
                ready.append(self.buffer[: match.end()].strip())
                self.buffer = self.buffer[match.end() :].lstrip()
                continue

            if len(self.buffer) < self.max_chars:
                break

            split_at = self.buffer.rfind(" ", 0, self.max_chars + 1)
            if split_at < self.max_chars // 2:
                split_at = self.max_chars
            ready.append(self.buffer[:split_at].strip())
            self.buffer = self.buffer[split_at:].lstrip()

        return [part for part in ready if part]

    def finish(self) -> list[str]:
        remainder = self.buffer.strip()
        self.buffer = ""
        return [remainder] if remainder else []


def deepgram_language(agent_doc: Dict[str, Any]) -> str:
    """Choose a phone STT language without hardcoding every call to Hindi."""
    supported = {
        str(item).strip().lower()
        for item in (agent_doc.get("supported_languages") or [])
        if item
    }
    default = str(agent_doc.get("default_language") or "en-IN").strip().lower()
    supported.add(default)

    # Deepgram's multilingual mode is useful for the common Hindi/English and
    # Gujarati/English code-switching used by this product.
    language_families = {item.split("-", 1)[0] for item in supported}
    if len(language_families) > 1:
        return "multi"
    if default.startswith("hi"):
        return "hi"
    if default.startswith("gu"):
        return "gu"
    return "en-IN"


@dataclass(frozen=True)
class VoiceRuntimeConfig:
    stt_model: str
    stt_language: str
    endpointing_ms: int
    utterance_end_ms: int
    delayed_flush_ms: int
    llm_model: str
    llm_max_tokens: int
    tts_voice: str

    @classmethod
    def from_agent(cls, agent_doc: Dict[str, Any]) -> "VoiceRuntimeConfig":
        endpointing = _bounded_int(
            agent_doc.get("stt_endpointing_ms", agent_doc.get("silence_timeout_ms")),
            500,
            300,
            1200,
        )
        utterance_end = _bounded_int(
            agent_doc.get("stt_utterance_end_ms"),
            endpointing + 350,
            endpointing + 100,
            1800,
        )
        delayed_flush = _bounded_int(
            agent_doc.get("voice_delayed_flush_ms"),
            500,
            300,
            1000,
        )
        return cls(
            stt_model=str(agent_doc.get("stt_model") or "nova-2"),
            stt_language=deepgram_language(agent_doc),
            endpointing_ms=endpointing,
            utterance_end_ms=utterance_end,
            delayed_flush_ms=delayed_flush,
            llm_model=str(agent_doc.get("llm_model") or ""),
            llm_max_tokens=_bounded_int(agent_doc.get("llm_max_tokens"), 160, 80, 220),
            tts_voice=_voice_label(agent_doc.get("tts_voice")),
        )


@dataclass
class VoiceTurnMetrics:
    user_text: str
    stt_provider: str = "deepgram"
    llm_model: str = ""
    tts_voice: str = ""
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    _start: float = field(default_factory=time.perf_counter, repr=False)
    llm_first_token_ms: Optional[int] = None
    llm_complete_ms: Optional[int] = None
    tts_first_audio_ms: Optional[int] = None
    complete_ms: Optional[int] = None

    def elapsed_ms(self) -> int:
        return int((time.perf_counter() - self._start) * 1000)

    def mark_llm_first_token(self) -> None:
        if self.llm_first_token_ms is None:
            self.llm_first_token_ms = self.elapsed_ms()

    def mark_llm_complete(self) -> None:
        self.llm_complete_ms = self.elapsed_ms()

    def mark_tts_first_audio(self) -> None:
        if self.tts_first_audio_ms is None:
            self.tts_first_audio_ms = self.elapsed_ms()

    def finish(self) -> None:
        self.complete_ms = self.elapsed_ms()

    def as_document(self) -> Dict[str, Any]:
        return {
            "started_at": self.started_at,
            "user_text": self.user_text[:500],
            "stt_provider": self.stt_provider,
            "llm_model": self.llm_model,
            "tts_voice": self.tts_voice,
            "llm_first_token_ms": self.llm_first_token_ms,
            "llm_complete_ms": self.llm_complete_ms,
            "tts_first_audio_ms": self.tts_first_audio_ms,
            "complete_ms": self.complete_ms,
        }
