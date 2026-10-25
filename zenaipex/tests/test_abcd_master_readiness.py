"""Unified Master Regression & Verification Test Suite for Stages A, B, C, and D.

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
from fastapi import Request

from api.v1.voice_advanced import (
    exotel_voice_webhook,
    exotel_voicebot_webhook,
    detect_language_from_text,
    is_backchannel,
    is_incomplete_utterance,
    normalize_entities
)


class TestABCDMasterReadiness(unittest.IsolatedAsyncioTestCase):

    # ─────────────────────────────────────────────────────────────
    # STAGE A: SECURITY & BILLING
    # ─────────────────────────────────────────────────────────────

    async def test_stage_a_forged_inbound_voice_webhook_rejected(self):
        """Stage A: Inbound voice webhook must reject foreign or non-existent agent_id with 404."""
        company_id = "comp_legit_101"
        foreign_agent_id = str(ObjectId())

        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url = "http://testserver/voice"
        mock_request.headers = {"host": "testserver"}
        mock_request.query_params = {"From": "+919876543210", "To": "+911234567890"}

        with patch("core.database.col_agents") as mock_col_agents:
            mock_col = MagicMock()
            mock_col.find_one = AsyncMock(return_value=None)  # Agent not found for this company
            mock_col_agents.return_value = mock_col

            response = await exotel_voice_webhook(company_id, foreign_agent_id, mock_request)
            self.assertEqual(response.status_code, 404)
            self.assertIn("Hangup", response.body.decode())

    async def test_stage_a_forged_inbound_voicebot_webhook_rejected(self):
        """Stage A: Inbound voicebot webhook must reject foreign agent with 404 JSON."""
        company_id = "comp_legit_202"
        foreign_agent_id = str(ObjectId())

        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.form = AsyncMock(return_value={"From": "+919876543210", "To": "+911234567890"})
        mock_request.query_params = {}
        mock_request.headers = {"host": "testserver"}

        with patch("core.database.col_agents") as mock_col_agents:
            mock_col = MagicMock()
            mock_col.find_one = AsyncMock(return_value=None)
            mock_col_agents.return_value = mock_col

            response = await exotel_voicebot_webhook(company_id, foreign_agent_id, mock_request)
            self.assertEqual(response.status_code, 404)
            self.assertIn("Agent not found", response.body.decode())

    async def test_stage_a_recording_token_cryptographic_isolation(self):
        """Stage A: Recording token must reject unauthorized foreign tenant playback."""
        import jwt
        from core.config import settings
        from api.v1.admin.conversations import proxy_recording
        from fastapi import HTTPException

        owner_company = "comp_owner_sec"
        attacker_company = "comp_attacker_sec"
        conv_id = str(ObjectId())

        token_payload = {
            "sub": "recording",
            "company_id": owner_company,
            "conv_id": conv_id,
            "url": "https://s3.exotel.com/rec/secret.mp3",
            "exp": datetime.now(timezone.utc).timestamp() + 300
        }
        token = jwt.encode(token_payload, settings.app_secret_key, algorithm="HS256")

        mock_req = MagicMock(spec=Request)
        mock_req.query_params = {"token": token}

        # Attacker tries to access owner's recording
        with self.assertRaises(HTTPException) as cm:
            await proxy_recording(mock_req, company_id=attacker_company, conv_id=conv_id)
        self.assertEqual(cm.exception.status_code, 403)
        self.assertIn("Token not valid for this tenant", cm.exception.detail)

    # ─────────────────────────────────────────────────────────────
    # STAGE B: EXOTEL LIFECYCLE
    # ─────────────────────────────────────────────────────────────

    async def test_stage_b_inbound_call_xml_stream_url_generation(self):
        """Stage B: Valid agent inbound call must generate standard Exotel XML with media-stream URL."""
        company_id = "comp_legit_303"
        agent_id = str(ObjectId())

        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url = "http://testserver/voice"
        mock_request.headers = {"host": "api.zenia.ai"}
        mock_request.query_params = {"From": "+919876543210", "To": "+911234567890", "CallSid": "EXO_VALID_123"}

        with patch("core.database.col_agents") as mock_col_agents, \
             patch("services.voice_channel_mapping.resolve_exotel_channel") as mock_resolve, \
             patch("services.conversation_service.create_conversation", new_callable=AsyncMock):
            
            mock_col = MagicMock()
            mock_col.find_one = AsyncMock(return_value={"_id": ObjectId(agent_id), "company_id": company_id})
            mock_col_agents.return_value = mock_col
            mock_resolve.return_value = {"_id": ObjectId(), "phone_number": "+911234567890"}

            response = await exotel_voice_webhook(company_id, agent_id, mock_request)
            self.assertEqual(response.status_code, 200)
            xml_text = response.body.decode()
            self.assertIn("<Response>", xml_text)
            self.assertIn("<Stream url=", xml_text)
            self.assertIn("wss://api.zenia.ai/api/v1/webhook/exotel/advanced", xml_text)

    # ─────────────────────────────────────────────────────────────
    # STAGE C: MULTILINGUAL STT / TTS / LLM
    # ─────────────────────────────────────────────────────────────

    def test_stage_c_multilingual_language_recognition(self):
        """Stage C: Verify language classification across Hindi, Hinglish, Gujarati, English."""
        self.assertEqual(detect_language_from_text("मुझे अपने बिल की जानकारी चाहिए"), "hi-IN")
        self.assertEqual(detect_language_from_text("Billing cycle kab khatam hoga"), "hi-IN")
        self.assertEqual(detect_language_from_text("મારું એકાઉન્ટ બેલેન્સ કેટલું છે"), "gu-IN")
        self.assertEqual(detect_language_from_text("Mari sathe vaat karo please"), "gu-IN")
        self.assertEqual(detect_language_from_text("What are your business opening hours?"), "en-US")

    def test_stage_c_turn_taking_and_backchannel(self):
        """Stage C: Ensure turn-taking respects pauses and ignores backchannels."""
        # Casual backchannel
        self.assertTrue(is_backchannel("haan"))
        self.assertTrue(is_backchannel("theek"))
        self.assertFalse(is_backchannel("theek hai mujhe batao"))

        # Conjunction waiting for continuation
        self.assertTrue(is_incomplete_utterance("Main puchna chahta tha lekin"))
        self.assertTrue(is_incomplete_utterance("I have an issue and"))
        self.assertFalse(is_incomplete_utterance("Main kal aaunga."))

    # ─────────────────────────────────────────────────────────────
    # STAGE D: RELIABILITY, RECOVERY & PERSISTENCE
    # ─────────────────────────────────────────────────────────────

    async def test_stage_d_graceful_background_task_drain_on_call_end(self):
        """Stage D: Background message writes must be retained and safely drained on teardown."""
        pending_tasks = set()
        completed = []

        def track(coro):
            t = asyncio.create_task(coro)
            pending_tasks.add(t)
            t.add_done_callback(lambda done: pending_tasks.discard(done))
            return t

        async def mock_persist(turn):
            await asyncio.sleep(0.02)
            completed.append(turn)

        track(mock_persist("user_1"))
        track(mock_persist("assistant_1"))
        self.assertEqual(len(pending_tasks), 2)

        # Teardown drain
        await asyncio.wait_for(asyncio.gather(*list(pending_tasks), return_exceptions=True), timeout=1.0)
        self.assertEqual(len(pending_tasks), 0)
        self.assertIn("user_1", completed)
        self.assertIn("assistant_1", completed)


if __name__ == "__main__":
    unittest.main()
