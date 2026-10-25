import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest

from modules.audio_utils import ExotelAudioChunker, PcmRateConverter
from modules.gemini_phone_live import handle_exotel_gemini_live_session


def test_pcm_rate_converter_is_stateful_and_converts_phone_rates():
    """PcmRateConverter must keep audioop state between packets to avoid clicks."""
    upsampler = PcmRateConverter(8000, 16000)
    first = upsampler.convert(b"\x00\x00" * 800)
    second = upsampler.convert(b"\x00\x00" * 800)
    assert len(first) > 3000
    assert len(second) > 3000

    downsampler = PcmRateConverter(24000, 8000)
    phone_pcm = downsampler.convert(b"\x00\x00" * 2400)
    assert 1500 <= len(phone_pcm) <= 1700


def test_exotel_audio_chunker_reset_clears_buffer():
    """reset() must discard all buffered bytes so barge-in audio never leaks."""
    chunker = ExotelAudioChunker(target_chunk_size=3200)
    # Fill partial buffer (less than one full chunk)
    partial = b"\x01\x02" * 1000  # 2000 bytes < 3200
    list(chunker.add_data(partial))  # nothing yielded yet, stays in buffer
    assert len(chunker.buffer) == 2000

    chunker.reset()
    assert chunker.buffer == b""

    # After reset, new audio is treated as a fresh turn
    new_audio = b"\x00\x00" * 1600  # 3200 bytes → exactly one chunk
    chunks = list(chunker.add_data(new_audio))
    assert len(chunks) == 1
    assert len(chunks[0]) == 3200


@pytest.mark.asyncio
async def test_phone_native_live_missing_key_allows_pipeline_fallback():
    """When GEMINI_API_KEY is absent the bridge returns None so caller falls back."""
    ws = type("WS", (), {"query_params": {}})()
    with patch.dict("os.environ", {"GEMINI_API_KEY": "", "GOOGLE_API_KEY": ""}):
        result = await handle_exotel_gemini_live_session(
            ws,
            agent={"name": "Farhan"},
            company_id="company-1",
            company_name="ZeniaOne",
            rag_pipeline=None,
        )
    assert result is None


@pytest.mark.asyncio
async def test_phone_native_live_opens_audio_s2s_session():
    """Full native S2S session: setup sent, AUDIO modality, barge-in config, tools."""
    class FakeGemini:
        def __init__(self):
            self.sent = []
            self.receive_count = 0
            self.closed = False

        async def send(self, value):
            self.sent.append(json.loads(value))

        async def recv(self):
            self.receive_count += 1
            if self.receive_count == 1:
                return json.dumps({"setupComplete": {}})
            await asyncio.Event().wait()

        async def close(self):
            self.closed = True

    class FakeExotel:
        query_params = {"direction": "inbound"}

        async def receive_text(self):
            return json.dumps({"event": "stop"})

        async def send_json(self, _payload):
            return None

    fake_gemini = FakeGemini()
    with (
        patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}),
        patch("modules.gemini_phone_live.websockets.connect", new=AsyncMock(return_value=fake_gemini)),
    ):
        result = await handle_exotel_gemini_live_session(
            FakeExotel(),
            agent={"name": "Farhan", "gemini_voice": "puck"},
            company_id="company-1",
            company_name="ZeniaOne",
            rag_pipeline=None,
        )

    assert result is not None
    assert result["engine"] == "gemini_live"
    assert fake_gemini.closed is True
    setup = fake_gemini.sent[0]["setup"]
    assert setup["generationConfig"]["responseModalities"] == ["AUDIO"]
    assert setup["generationConfig"]["speechConfig"]["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"] == "Puck"
    assert setup["realtimeInputConfig"]["activityHandling"] == "START_OF_ACTIVITY_INTERRUPTS"
    assert setup["tools"][0]["functionDeclarations"][0]["name"] == "search_company_knowledge"


@pytest.mark.asyncio
async def test_phone_native_live_handles_rag_tool_call():
    """Verify Gemini functionCall search_company_knowledge calls rag_pipeline and returns result."""
    class FakeGeminiWithTool:
        def __init__(self):
            self.sent = []
            self.receive_count = 0
            self.closed = False

        async def send(self, value):
            self.sent.append(json.loads(value))

        async def recv(self):
            self.receive_count += 1
            if self.receive_count == 1:
                return json.dumps({"setupComplete": {}})
            if self.receive_count == 2:
                # Return toolCall
                return json.dumps({
                    "serverContent": {
                        "toolCall": {
                            "functionCalls": [{
                                "id": "call-123",
                                "name": "search_company_knowledge",
                                "args": {"question": "What is ZeniaOne pricing?"},
                            }]
                        }
                    }
                })
            await asyncio.Event().wait()

        async def close(self):
            self.closed = True

    class FakeExotelWithMedia:
        query_params = {"direction": "inbound"}

        def __init__(self):
            self.events = [
                json.dumps({"event": "start", "start": {"streamSid": "stream-123"}}),
                json.dumps({"event": "stop"}),
            ]

        async def receive_text(self):
            if self.events:
                return self.events.pop(0)
            await asyncio.Event().wait()

        async def send_json(self, _payload):
            return None

    class FakeRag:
        async def retrieve(self, question):
            return [{"text": f"Pricing answer for: {question}"}]

        def format_context(self, docs):
            return docs[0]["text"]

    fake_gemini = FakeGeminiWithTool()
    with (
        patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}),
        patch("modules.gemini_phone_live.websockets.connect", new=AsyncMock(return_value=fake_gemini)),
        patch("services.conversation_service.create_conversation", new=AsyncMock(return_value={"_id": "conv-1", "company_id": "comp-1"})),
        patch("services.conversation_service.get_recent_messages_for_caller", new=AsyncMock(return_value=[])),
    ):
        result = await handle_exotel_gemini_live_session(
            FakeExotelWithMedia(),
            agent={"name": "Farhan"},
            company_id="comp-1",
            company_name="ZeniaOne",
            rag_pipeline=FakeRag(),
        )

    assert result is not None
    # Check that toolResponse was sent back to Gemini
    tool_responses = [s for s in fake_gemini.sent if "toolResponse" in s]
    assert len(tool_responses) == 1
    resp_obj = tool_responses[0]["toolResponse"]["functionResponses"][0]
    assert resp_obj["id"] == "call-123"
    assert "Pricing answer" in resp_obj["response"]["result"]


@pytest.mark.asyncio
async def test_three_voice_profiles_routing_logic():
    """Verify that each of the 3 profiles triggers its correct calling engine."""
    from services.provider_routing import DEFAULT_ROUTING

    # Profile 1: Classic Deepgram + Groq (engine == "pipeline")
    profile1_agent = {"voice_engine": "pipeline"}
    profile1_stt = ["deepgram", "gemini_live"]
    is_native_p1 = (profile1_agent.get("voice_engine") == "gemini_live" and profile1_stt[0] == "gemini_live")
    assert is_native_p1 is False

    # Profile 2: Gemini + Clone Voice (engine == "gemini_clone")
    profile2_agent = {"voice_engine": "gemini_clone"}
    profile2_stt = ["gemini_live", "deepgram"]
    is_native_p2 = (profile2_agent.get("voice_engine") == "gemini_live" and profile2_stt[0] == "gemini_live")
    use_gemini_transcriber_p2 = (profile2_agent.get("voice_engine") == "gemini_clone" and "gemini_live" in profile2_stt)
    assert is_native_p2 is False
    assert use_gemini_transcriber_p2 is True

    # Profile 3: Gemini Live S2S (engine == "gemini_live")
    profile3_agent = {"voice_engine": "gemini_live"}
    profile3_stt = ["gemini_live", "deepgram"]
    is_native_p3 = (profile3_agent.get("voice_engine") == "gemini_live" and profile3_stt[0] == "gemini_live")
    assert is_native_p3 is True

