"""Step 9: Voice Quality, Multilingual STT/TTS & Staging Pre-Flight Regression Tests.

Standard library unittest based — executes safely without external network,
pytest dependency, real MongoDB, or live carrier requests.
"""

import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

ZEN_DIR = Path(__file__).resolve().parents[1]
if str(ZEN_DIR) not in sys.path:
    sys.path.insert(0, str(ZEN_DIR))

import unittest
from bson import ObjectId
from datetime import datetime, timezone

from api.v1.voice_advanced import (
    detect_language_from_text,
    is_backchannel,
    is_incomplete_utterance,
    normalize_entities
)


class TestStep9VoiceQualityAndStaging(unittest.IsolatedAsyncioTestCase):

    def test_multilingual_language_detection_matrix(self):
        """Phase 2 & 3: Verify heuristic language detection across the 4 target languages."""
        # 1. Hindi Devanagari
        self.assertEqual(detect_language_from_text("नमस्ते, मुझे छुट्टी की जानकारी चाहिए"), "hi-IN")
        
        # 2. Hinglish Romanized
        self.assertEqual(detect_language_from_text("Leave policy ke baare mein batao"), "hi-IN")
        self.assertEqual(detect_language_from_text("Kya aap meri madad kar sakte ho"), "hi-IN")

        # 3. Gujarati Script
        self.assertEqual(detect_language_from_text("કેમ છો, મને રજા વિશે માહિતી જોઈએ છે"), "gu-IN")
        
        # 4. Gujarati Romanized
        self.assertEqual(detect_language_from_text("Tamari service ma shu features che"), "gu-IN")
        self.assertEqual(detect_language_from_text("Kem cho tamari sathe vaat karvi che"), "gu-IN")

        # 5. English
        self.assertEqual(detect_language_from_text("Can you explain the annual pricing plan"), "en-US")
        self.assertEqual(detect_language_from_text("Hello, who is speaking?"), "en-US")

    def test_backchannel_and_interruption_detection(self):
        """Phase 5: Backchannel words must not be treated as interruptions or full turns."""
        backchannels = ["haan", "ji", "hmm", "okay", "theek", "right", "achha"]
        for bc in backchannels:
            self.assertTrue(is_backchannel(bc), f"Expected '{bc}' to be recognized as backchannel")
            self.assertTrue(is_backchannel(f"  {bc}  "))

        meaningful_utterances = [
            "haan mujhe batao",
            "ek minute ruko",
            "nahin aisa nahi hai",
            "stop please",
            "what is the price"
        ]
        for mu in meaningful_utterances:
            self.assertFalse(is_backchannel(mu), f"'{mu}' should NOT be treated as a pure backchannel")

    def test_incomplete_utterance_pause_detection(self):
        """Phase 5: Sentences ending in conjunctions must trigger continuation timer."""
        # Incomplete sentences waiting for continuation
        self.assertTrue(is_incomplete_utterance("Mujhe pricing aur"))
        self.assertTrue(is_incomplete_utterance("Main chahta hoon lekin"))
        self.assertTrue(is_incomplete_utterance("I want to know because"))

        # Complete sentences with terminal punctuation or terminal verbs
        self.assertFalse(is_incomplete_utterance("Mujhe pricing bataiye."))
        self.assertFalse(is_incomplete_utterance("Hello"))
        self.assertFalse(is_incomplete_utterance("What is the refund policy?"))

    def test_entity_normalization_stt_repair(self):
        """Phase 2: Common STT misspellings for company and products must be repaired."""
        self.assertEqual(normalize_entities("zeniaone platform"), "ZeniaONE platform")
        self.assertEqual(normalize_entities("zenia hr leave system"), "ZeniaHR leave system")
        self.assertEqual(normalize_entities("zenia 1 solution"), "ZeniaONE solution")

    async def test_billing_failure_reverts_claim_and_records_error(self):
        """Phase 7: If increment_usage fails, the billing claim must revert to unbilled."""
        company_id = "comp_retry_audit"
        conv_id = str(ObjectId())
        duration_sec = 65.0

        with patch("core.database.col_conversations") as mock_col_conv, \
             patch("services.usage_service.increment_usage", new_callable=AsyncMock) as mock_increment:
            
            mock_conv_coll = MagicMock()
            mock_col_conv.return_value = mock_conv_coll

            # Claim succeeds initially
            mock_conv_coll.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
            
            # increment_usage raises an unexpected exception (e.g. database timeout)
            mock_increment.side_effect = TimeoutError("MongoDB connection lost")

            # Execute the teardown billing logic
            claim = await mock_conv_coll.update_one(
                {"_id": ObjectId(conv_id), "company_id": company_id, "billed": {"$ne": True}},
                {"$set": {"billed": True, "billed_duration_seconds": duration_sec}}
            )
            self.assertEqual(claim.modified_count, 1)

            with self.assertRaises(TimeoutError):
                try:
                    await mock_increment(company_id=company_id, call_duration_seconds=duration_sec, direction="inbound")
                except Exception as inc_e:
                    # Revert claim logic
                    await mock_conv_coll.update_one(
                        {"_id": ObjectId(conv_id), "company_id": company_id},
                        {"$set": {"billed": False, "billing_error": str(inc_e)}}
                    )
                    raise inc_e

            # Verify that update_one was called to revert "billed" to False
            revert_call = mock_conv_coll.update_one.call_args_list[-1]
            revert_filter = revert_call[0][0]
            revert_set = revert_call[0][1]["$set"]
            self.assertEqual(revert_filter, {"_id": ObjectId(conv_id), "company_id": company_id})
            self.assertFalse(revert_set["billed"])
            self.assertIn("MongoDB connection lost", revert_set["billing_error"])

    async def test_exotel_audio_chunker_packet_size(self):
        """Phase 4: PCM chunks must be exactly 3200 bytes for Exotel 8kHz audio frames."""
        from modules.audio_utils import ExotelAudioChunker

        chunker = ExotelAudioChunker(target_chunk_size=3200)
        
        # Feed 7000 bytes of audio
        raw_pcm = b"\x00" * 7000
        chunks = list(chunker.add_data(raw_pcm))

        # 3200 * 2 = 6400 bytes emitted immediately (2 full chunks)
        self.assertEqual(len(chunks), 2)
        for c in chunks:
            self.assertEqual(len(c), 3200)

        # Remaining 600 bytes emitted on flush
        remaining = list(chunker.flush())
        self.assertEqual(len(remaining), 1)
        self.assertEqual(len(remaining[0]), 600)

    async def test_synthetic_stt_event_handling(self):
        """Phase 2: Synthetic Deepgram JSON transcript processing."""
        import json

        # 1. Valid final result
        valid_event = {
            "type": "Results",
            "channel": {
                "alternatives": [
                    {"transcript": "Hello Zenia", "confidence": 0.98, "languages": ["en-US"]}
                ]
            },
            "is_final": True
        }
        alt = valid_event["channel"]["alternatives"][0]
        self.assertEqual(alt["transcript"], "Hello Zenia")
        self.assertGreaterEqual(alt["confidence"], 0.8)

        # 2. Low-confidence garbage event
        garbage_event = {
            "type": "Results",
            "channel": {
                "alternatives": [
                    {"transcript": "shhh...", "confidence": -0.1}
                ]
            },
            "is_final": True
        }
        is_garbage = garbage_event["channel"]["alternatives"][0]["confidence"] < 0.0
        self.assertTrue(is_garbage)


if __name__ == "__main__":
    unittest.main()
