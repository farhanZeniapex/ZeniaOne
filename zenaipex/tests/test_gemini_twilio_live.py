import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest

from modules.audio_utils import mulaw_to_pcm, pcm_to_mulaw
from modules.gemini_twilio_live import handle_twilio_gemini_live_session


def test_twilio_mulaw_round_trip_is_telephony_sized():
    pcm = b"\x00\x00" * 160
    encoded = pcm_to_mulaw(pcm)
    decoded = mulaw_to_pcm(encoded)
    assert len(encoded) == 160
    assert len(decoded) == len(pcm)


@pytest.mark.asyncio
async def test_twilio_native_bridge_sets_audio_s2s_and_finishes_cleanly():
    class FakeGemini:
        def __init__(self):
            self.sent = []
            self.recv_count = 0
            self.closed = False

        async def send(self, payload):
            self.sent.append(json.loads(payload))

        async def recv(self):
            self.recv_count += 1
            if self.recv_count == 1:
                return json.dumps({"setupComplete": {}})
            await asyncio.Event().wait()

        async def close(self):
            self.closed = True

    class FakeTwilio:
        query_params = {"direction": "inbound"}

        async def receive_text(self):
            return json.dumps({"event": "stop"})

        async def send_json(self, _payload):
            return None

    fake_gemini = FakeGemini()
    fake_conversation = {"_id": "conversation-1"}
    with (
        patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}),
        patch("modules.gemini_twilio_live.websockets.connect", new=AsyncMock(return_value=fake_gemini)),
        patch("services.conversation_service.create_conversation", new=AsyncMock(return_value=fake_conversation)),
        patch("services.conversation_service.add_message", new=AsyncMock()),
        patch("services.conversation_service.end_conversation", new=AsyncMock()),
        patch("services.usage_service.increment_usage", new=AsyncMock()),
    ):
        result = await handle_twilio_gemini_live_session(
            FakeTwilio(),
            start_data={
                "streamSid": "MZ-stream",
                "callSid": "CA-call",
                "customParameters": {"caller": "+919999999999", "called_number": "+17372508034"},
            },
            agent_context={
                "company_id": "company-1",
                "company": {"name": "ZeniaOne", "settings": {}},
                "agent": {"_id": "agent-1", "name": "Farhan", "gemini_voice": "puck"},
                "channel": {"_id": "channel-1"},
            },
            rag_pipeline=None,
        )

    assert result["conversation_id"] == "conversation-1"
    assert fake_gemini.closed is True
    setup = fake_gemini.sent[0]["setup"]
    assert setup["generationConfig"]["responseModalities"] == ["AUDIO"]
    assert setup["generationConfig"]["speechConfig"]["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"] == "Puck"
    assert setup["realtimeInputConfig"]["activityHandling"] == "START_OF_ACTIVITY_INTERRUPTS"
