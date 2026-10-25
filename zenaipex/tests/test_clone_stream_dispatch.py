"""Regression coverage for clone TTS stream dispatch.

This test replaces the network stream with an in-process async generator, so it
does not contact Sarvam and does not consume any provider credits.
"""
import unittest
from unittest.mock import patch

from modules import sarvam_tts


class CloneStreamDispatchTests(unittest.IsolatedAsyncioTestCase):
    async def test_custom_clone_uses_clone_stream_and_yields_audio(self):
        calls = []

        async def fake_resolve_speaker(speaker: str) -> str:
            self.assertEqual(speaker, "saved-clone-id")
            return "svc-clone-123"

        async def fake_clone_stream(**kwargs):
            calls.append(kwargs)
            yield b"first-audio"
            yield b"second-audio"

        with patch.object(sarvam_tts, "resolve_speaker", fake_resolve_speaker), patch.object(
            sarvam_tts, "cloned_voice_tts_stream", fake_clone_stream
        ):
            chunks = [
                chunk
                async for chunk in sarvam_tts.realtime_tts_stream(
                    "Namaste", language="hi-IN", speaker="saved-clone-id"
                )
            ]

        self.assertEqual(chunks, [b"first-audio", b"second-audio"])
        self.assertEqual(
            calls,
            [
                {
                    "text": "Namaste",
                    "voice_id": "svc-clone-123",
                    "language": "hi-IN",
                    "sample_rate": 24000,
                }
            ],
        )

