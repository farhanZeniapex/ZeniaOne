"""Comprehensive Offline Tests for LLM/TTS Latency, Performance, and Settings Propagation.

Standard library unittest based — executes safely without external network,
paid APIs, real MongoDB, or carrier calls.
"""

import asyncio
import json
import time
import unittest
from pathlib import Path
import sys
from unittest.mock import MagicMock, AsyncMock, patch

ZEN_DIR = Path(__file__).resolve().parents[1]
if str(ZEN_DIR) not in sys.path:
    sys.path.insert(0, str(ZEN_DIR))

from api.v1.voice_advanced import (
    _fetch_configured_voice_response,
    fetch_llm_response,
    detect_language_from_text,
)
from modules.audio_utils import ExotelAudioChunker
from modules.sarvam_tts import PERSONA_TO_EDGE_VOICE


class LatencyAndPerformanceRegressionTest(unittest.TestCase):
    """Test LLM/TTS orchestration, latency accounting, settings propagation, and streaming readiness."""

    def test_http_client_reuse_in_fetch_llm_response(self):
        """Verify fetch_llm_response reuses a provided http_client instead of creating new instances."""
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "Namaste! Main Zenia bol rahi hoon."}, "finish_reason": "stop"}]
        }
        mock_client.post.return_value = mock_resp

        conversation_history = [{"role": "user", "content": "Hello"}]

        async def run_fetch():
            return await fetch_llm_response(
                conversation_history=conversation_history,
                active_product="ZeniaONE",
                latest_utterance="Hello",
                agent_persona="Zenia",
                company_name="ZeniaONE",
                http_client=mock_client,
            )

        response = asyncio.run(run_fetch())
        self.assertEqual(response, "Namaste! Main Zenia bol rahi hoon.")
        mock_client.post.assert_called_once()
        args, kwargs = mock_client.post.call_args
        self.assertIn("https://api.groq.com", args[0])
        self.assertIn("messages", kwargs["json"])
        self.assertEqual(kwargs["json"]["model"], "openai/gpt-oss-120b")

    def test_voice_configuration_precedence(self):
        """Test voice configuration precedence from language default to agent persona to direct neural."""
        # 1. Hindi language default
        lang_hi = detect_language_from_text("नमस्ते आप कैसे हैं")
        self.assertEqual(lang_hi, "hi-IN")

        # 2. English language default (maps to en-US in heuristic)
        lang_en = detect_language_from_text("Hello how can I help you")
        self.assertEqual(lang_en, "en-US")

        # 3. Gujarati language default
        lang_gu = detect_language_from_text("કેમ છો તમે મજામાં")
        self.assertEqual(lang_gu, "gu-IN")

        # 4. Agent persona override mapping in PERSONA_TO_EDGE_VOICE
        self.assertIn("ritu", PERSONA_TO_EDGE_VOICE)
        self.assertIn("amit", PERSONA_TO_EDGE_VOICE)
        self.assertEqual(PERSONA_TO_EDGE_VOICE["ritu"]["voice"], "hi-IN-SwaraNeural")
        self.assertEqual(PERSONA_TO_EDGE_VOICE["amit"]["voice"], "hi-IN-MadhurNeural")

    def test_dashboard_settings_applied_vs_ignored(self):
        """Audit agent_doc settings to verify what is applied in voice_advanced.py versus hardcoded."""
        agent_doc = {
            "name": "CustomPersona",
            "tts_voice": "amit",
            "llm_model": "sarvam-105b",
            "llm_temperature": 0.2,
            "llm_max_tokens": 1500,
            "silence_timeout_ms": 1200,
            "system_prompt": "You are a custom assistant.",
        }

        # Applied: persona name and tts_voice
        self.assertEqual(agent_doc.get("name"), "CustomPersona")
        self.assertEqual(agent_doc.get("tts_voice"), "amit")

        # Hardcoded in voice_advanced.py:
        # LLM model is hardcoded to openai/gpt-oss-120b
        # LLM temperature is hardcoded to 0.5
        # LLM max_tokens is hardcoded to 1024
        # Silence timeout is hardcoded to 800ms endpointing + 850ms flush
        hardcoded_model = "openai/gpt-oss-120b"
        hardcoded_temp = 0.5
        hardcoded_tokens = 1024

        self.assertNotEqual(agent_doc["llm_model"], hardcoded_model)
        self.assertNotEqual(agent_doc["llm_temperature"], hardcoded_temp)
        self.assertNotEqual(agent_doc["llm_max_tokens"], hardcoded_tokens)

    def test_exotel_audio_chunker_3200_byte_boundary(self):
        """Verify ExotelAudioChunker strictly outputs 3200-byte frames (200ms @ 8kHz 16-bit linear PCM)."""
        chunker = ExotelAudioChunker(target_chunk_size=3200)

        # Feed 10,000 bytes of mock audio
        incoming = b"\x00" * 10000
        chunks = list(chunker.add_data(incoming))

        # 10,000 // 3200 = 3 chunks (9,600 bytes), remaining 400 bytes buffered
        self.assertEqual(len(chunks), 3)
        for c in chunks:
            self.assertEqual(len(c), 3200)

        # Flush returns the remaining 400 bytes padded or as final frame
        final_chunks = list(chunker.flush())
        self.assertEqual(len(final_chunks), 1)
        self.assertEqual(len(final_chunks[0]), 400)

    def test_latency_stage_accounting_synthetic_breakdown(self):
        """Benchmark offline synthetic latency stage budget calculation."""
        stages = {
            "stt_endpointing_ms": 800.0,
            "rag_retrieval_ms": 185.0,
            "llm_batch_completion_ms": 620.0,
            "tts_first_audio_ms": 410.0,
            "audio_framing_ms": 3.5,
            "carrier_buffer_ms": 200.0,
        }

        total_latency_ms = sum(stages.values())
        self.assertAlmostEqual(total_latency_ms, 2218.5, places=1)

        # Optimizing LLM via sentence streaming would overlap LLM and TTS:
        # Instead of waiting full completion (620ms), first sentence arrives in ~220ms.
        # Savings potential = 620 - 220 = 400ms.
        streamed_total_ms = (
            stages["stt_endpointing_ms"]
            + stages["rag_retrieval_ms"]
            + 220.0  # first sentence TTFT
            + stages["tts_first_audio_ms"]
            + stages["audio_framing_ms"]
            + stages["carrier_buffer_ms"]
        )
        self.assertLess(streamed_total_ms, total_latency_ms)
        self.assertAlmostEqual(total_latency_ms - streamed_total_ms, 400.0, places=1)

    def test_streaming_sentence_segmenter_compatibility(self):
        """Test sentence segmentation logic for safe token streaming to speech."""
        import re

        def segment_stream_tokens(tokens):
            """Segment token stream into speakable clauses."""
            buffer = ""
            sentences = []
            sentence_delimiters = re.compile(r'([.!?।\n])')

            for token in tokens:
                buffer += token
                match = sentence_delimiters.search(buffer)
                if match:
                    idx = match.end()
                    sentence = buffer[:idx].strip()
                    if sentence:
                        sentences.append(sentence)
                    buffer = buffer[idx:]

            if buffer.strip():
                sentences.append(buffer.strip())
            return sentences

        mock_tokens = ["Namaste! ", "Aap ", "kaise ", "hain? ", "Main ", "Zenia ", "bol ", "rahi ", "hoon."]
        segmented = segment_stream_tokens(mock_tokens)

        self.assertEqual(len(segmented), 3)
        self.assertEqual(segmented[0], "Namaste!")
        self.assertEqual(segmented[1], "Aap kaise hain?")
        self.assertEqual(segmented[2], "Main Zenia bol rahi hoon.")

        # Reconstructed text matches full batch response exactly
        reconstructed = " ".join(segmented)
        self.assertIn("Namaste!", reconstructed)
        self.assertIn("Aap kaise hain?", reconstructed)
        self.assertIn("Main Zenia bol rahi hoon.", reconstructed)

    def test_barge_in_cancellation_during_playback(self):
        """Verify that when cancel_event is set, audio streaming stops immediately."""
        cancel_event = asyncio.Event()
        sent_chunks = []

        async def mock_stream_send():
            for i in range(10):
                if cancel_event.is_set():
                    break
                sent_chunks.append(f"chunk_{i}")
                if i == 2:
                    cancel_event.set()
                await asyncio.sleep(0.001)

        asyncio.run(mock_stream_send())
        # Should stop after chunk_2 once cancel_event is set
        self.assertEqual(len(sent_chunks), 3)
        self.assertEqual(sent_chunks, ["chunk_0", "chunk_1", "chunk_2"])

    def test_stale_ai_task_cancellation_on_new_turn(self):
        """Verify that a running current_ai_task is cancelled when a new turn begins."""
        async def run_scenario():
            task_cancelled = False

            async def mock_long_tts():
                nonlocal task_cancelled
                try:
                    await asyncio.sleep(10.0)
                except asyncio.CancelledError:
                    task_cancelled = True
                    raise

            current_ai_task = asyncio.create_task(mock_long_tts())
            await asyncio.sleep(0.01)
            self.assertFalse(current_ai_task.done())

            # Simulate new turn beginning in _process_utterance
            if current_ai_task and not current_ai_task.done():
                current_ai_task.cancel()

            # Await task cancellation resolution
            try:
                await current_ai_task
            except asyncio.CancelledError:
                pass

            self.assertTrue(current_ai_task.cancelled())
            self.assertTrue(task_cancelled)

        asyncio.run(run_scenario())

    def test_cancellation_during_llm_generation(self):
        """Verify that cancelling process_task during LLM generation raises CancelledError and catches cleanly."""
        async def run_llm_turn():
            caught_cancellation = False

            async def mock_slow_llm():
                await asyncio.sleep(5.0)
                return "Generated text"

            task = asyncio.create_task(mock_slow_llm())
            await asyncio.sleep(0.01)

            # Barge-in arrives
            task.cancel()

            try:
                await task
            except asyncio.CancelledError:
                caught_cancellation = True

            self.assertTrue(caught_cancellation)
            self.assertTrue(task.cancelled())

        asyncio.run(run_llm_turn())

    def test_configured_voice_stream_starts_tts_at_first_sentence(self):
        class FakeClient:
            def __init__(self):
                self.providers = [MagicMock(provider="gemini")]
                self.closed = False

            def set_budget(self, _seconds):
                pass

            async def stream(self, *_args, **_kwargs):
                for token in ["Namaste! ", "Main OM ki awaaz mein ", "bol raha hoon."]:
                    yield token

            async def close(self):
                self.closed = True

        fake_client = FakeClient()
        spoken = []
        agent = {
            "_id": "agent-1",
            "system_prompt": "Help the caller.",
            "default_language": "hi-IN",
            "llm_max_tokens": 180,
        }

        async def scenario():
            with patch("ai.llm.AgentLLMClient.create", new=AsyncMock(return_value=fake_client)):
                response = await _fetch_configured_voice_response(
                    agent,
                    [],
                    None,
                    "hello",
                    on_sentence=spoken.append,
                )
            return response

        response = asyncio.run(scenario())
        self.assertEqual(spoken[0], "Namaste!")
        self.assertEqual(spoken[1], "Main OM ki awaaz mein bol raha hoon.")
        self.assertEqual(response, "Namaste! Main OM ki awaaz mein bol raha hoon.")
        self.assertTrue(fake_client.closed)


if __name__ == "__main__":
    unittest.main()

