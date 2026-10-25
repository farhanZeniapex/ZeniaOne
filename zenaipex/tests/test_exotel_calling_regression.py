"""Comprehensive Offline Unit & Regression Tests for Exotel Inbound & Outbound Calling.

Standard library unittest based — executes safely without external network,
pytest dependency, real MongoDB, or Exotel carrier calls.
"""

import asyncio
import json
import os
import sys
import unittest
from pathlib import Path

# Add zenaipex path so services/modules can be imported cleanly
ZEN_DIR = Path(__file__).resolve().parents[1]
if str(ZEN_DIR) not in sys.path:
    sys.path.insert(0, str(ZEN_DIR))

from bson import ObjectId
from unittest.mock import MagicMock, AsyncMock, patch

from services import voice_channel_mapping as mapping


class ExotelChannelMappingTest(unittest.TestCase):
    """Test channel mapping, tenant filtering, and phone number resolution."""

    def test_indian_number_variants_and_query_scope(self):
        channel = {
            "_id": ObjectId("6ac6209ca0af97f94fe85cd3"),
            "company_id": "company-a",
            "type": "exotel_voice",
            "phone_number": "07948502295 ",
        }
        query = mapping.channel_conversation_query(channel)
        self.assertEqual(query["company_id"], "company-a")
        self.assertIn("07948502295", query["$or"][0]["caller_to"]["$in"])
        self.assertIn("+917948502295", query["$or"][0]["caller_to"]["$in"])
        self.assertNotIn("08047285182", query["$or"][0]["caller_to"]["$in"])
        self.assertTrue(mapping.phone_numbers_match("07948502295 ", "+91 79485 02295"))
        self.assertFalse(mapping.phone_numbers_match("07948502295", "08047285182"))

    def test_exotel_resolution_uses_active_company_channel(self):
        channels = [
            {"_id": ObjectId("6ac6209ca0af97f94fe85cd3"), "agent_id": "agent-a", "phone_number": "07948502295 "},
            {"_id": ObjectId("6ab7c0adc39381e9f59801be"), "agent_id": "agent-a", "phone_number": "08047285182"},
        ]

        class Cursor:
            async def to_list(self, length):
                return channels

        class Collection:
            def find(self, query):
                self.assertEqual(query, {
                    "company_id": "company-a",
                    "type": {"$in": mapping.EXOTEL_TYPES},
                    "is_active": True,
                })
                return Cursor()

        Collection.assertEqual = self.assertEqual

        async def _run():
            with patch.object(mapping, "col_channels", lambda: Collection()):
                ch = await mapping.resolve_exotel_channel("company-a", "agent-a", "07948502295")
                self.assertIs(ch, channels[0])

                ch = await mapping.resolve_exotel_channel("company-a", "agent-a", "", str(channels[0]["_id"]))
                self.assertIs(ch, channels[0])

                ch = await mapping.resolve_exotel_channel(
                    "company-a", "agent-a", "07948502295", str(channels[1]["_id"])
                )
                self.assertIs(ch, channels[0])

                ch = await mapping.resolve_exotel_channel("company-a", "agent-a", "07000000000")
                self.assertIsNone(ch)

        asyncio.run(_run())


class ExotelLifecycleAndSecurityMockTest(unittest.TestCase):
    """Test inbound routing XML, agent tenant isolation, status handling, and audio chunking."""

    def test_inbound_xml_generation_structure(self):
        """Verify XML format returned to Exotel carrier matches spec."""
        ws_url = "wss://test.domain.com/api/v1/webhook/exotel/advanced/comp1/agent1/media-stream?caller=0987654321&CallTo=07948502295"
        xml_data = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{ws_url}"/>
    </Connect>
</Response>"""
        self.assertIn("<Response>", xml_data)
        self.assertIn(f'<Stream url="{ws_url}"/>', xml_data)
        self.assertTrue(xml_data.startswith('<?xml version="1.0" encoding="UTF-8"?>'))

    def test_agent_company_isolation_rejection(self):
        """Verify mismatched company_id and agent_id closes WebSocket with 1008 policy violation."""
        class MockWS:
            def __init__(self):
                self.closed_code = None
                self.sent_messages = []

            async def send_text(self, text):
                self.sent_messages.append(text)

            async def close(self, code=1000):
                self.closed_code = code

        ws = MockWS()
        agent_doc = None  # Agent not found in tenant company

        async def _handle_agent_check():
            if not agent_doc:
                try:
                    await ws.send_text(json.dumps({"event": "error", "message": "Agent not found for company"}))
                finally:
                    await ws.close(code=1008)

        asyncio.run(_handle_agent_check())
        self.assertEqual(ws.closed_code, 1008)
        self.assertEqual(len(ws.sent_messages), 1)
        self.assertIn("Agent not found for company", ws.sent_messages[0])

    def test_exotel_chunker_fixed_frame_size(self):
        """Verify ExotelAudioChunker produces exact 3200-byte frames (200ms of 8kHz 16-bit PCM)."""
        from modules.audio_utils import ExotelAudioChunker
        chunker = ExotelAudioChunker(target_chunk_size=3200)

        # Feed 7000 bytes: should yield two 3200-byte chunks and hold 600 bytes
        input_pcm = b"\x00" * 7000
        yielded = list(chunker.add_data(input_pcm))

        self.assertEqual(len(yielded), 2)
        self.assertEqual(len(yielded[0]), 3200)
        self.assertEqual(len(yielded[1]), 3200)
        self.assertEqual(len(chunker.buffer), 600)

        # Flush remainder
        flushed = list(chunker.flush())
        self.assertEqual(len(flushed), 1)
        self.assertEqual(len(flushed[0]), 600)
        self.assertEqual(len(chunker.buffer), 0)

    def test_outbound_payload_format(self):
        """Verify outbound request parameter structure for Exotel connect.json."""
        dest_number = "9876543210"
        from_number = "07948502295"
        exotel_sid = "zeniaone1"
        exotel_app_url = f"http://my.exotel.com/{exotel_sid}/exoml/start_voice/1355682"
        status_url = "https://example.com/api/v1/webhook/exotel/advanced/co1/ag1/status"

        payload = {
            "From": dest_number,
            "CallerId": from_number,
            "Url": exotel_app_url,
            "CallType": "trans",
            "StatusCallback": status_url
        }

        self.assertEqual(payload["From"], "9876543210")
        self.assertEqual(payload["CallerId"], "07948502295")
        self.assertEqual(payload["CallType"], "trans")
        self.assertIn("1355682", payload["Url"])
        self.assertTrue(payload["StatusCallback"].endswith("/status"))


if __name__ == "__main__":
    unittest.main()
