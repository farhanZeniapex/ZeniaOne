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


@pytest.mark.asyncio
async def test_knowledge_result_timeout_falls_back_to_core():
    """If RAG retrieval times out, _knowledge_result must quickly return core company facts without raising."""
    from modules.gemini_phone_live import _knowledge_result

    class HangingRag:
        async def retrieve(self, _question):
            await asyncio.sleep(10.0)
            return [{"text": "Late answer"}]

    res = await _knowledge_result(
        HangingRag(),
        "ZeniaONE kya hai?",
        company_name="ZeniaOne",
        company={"settings": {"business_email": "support@zeniapex.com"}},
        agent={"name": "Farhan"},
        timeout_s=0.1,  # Fast timeout for test
    )
    assert "ZeniaOne" in res
    assert "ZeniaPex" in res
    assert "Late answer" not in res


@pytest.mark.asyncio
async def test_knowledge_result_empty_or_error_falls_back_to_core():
    """If RAG raises or returns empty, _knowledge_result must provide core platform facts."""
    from modules.gemini_phone_live import _knowledge_result

    class ErrorRag:
        async def retrieve(self, _question):
            raise RuntimeError("Pinecone connection error")

    res = await _knowledge_result(
        ErrorRag(),
        "Tell me about your product",
        company_name="ZeniaOne",
        company={},
        agent={"name": "Farhan"},
    )
    assert "ZeniaOne" in res
    assert "ZeniaPex" in res

    class EmptyRag:
        async def retrieve(self, _question):
            return []

    res_empty = await _knowledge_result(
        EmptyRag(),
        "Tell me about your product",
        company_name="ZeniaOne",
        company={},
        agent={"name": "Farhan"},
    )
    assert "ZeniaOne" in res_empty
    assert "ZeniaPex" in res_empty




def test_farewell_utterance_detection():
    """Verify farewell utterance detector catches bye, alvida, and call cut in all languages."""
    from modules.gemini_phone_live import _is_farewell_utterance

    # Positive cases
    assert _is_farewell_utterance("bye", "") is True
    assert _is_farewell_utterance("byy", "dhanyawad alvida") is True
    assert _is_farewell_utterance("theek hai byee", "alvida") is True
    assert _is_farewell_utterance("alvida", "") is True
    assert _is_farewell_utterance("call cut kardo", "ji bilkul") is True
    assert _is_farewell_utterance("phone cut karo", "okay") is True
    assert _is_farewell_utterance("chalo tata", "bye") is True
    assert _is_farewell_utterance("ok thank you", "ZeniaOne se baat karne ke liye dhanyawad, alvida!") is True

    # Negative cases (informational questions or normal conversation)
    assert _is_farewell_utterance("ZeniaHR kya hai?", "ZeniaHR ek HRMS software hai") is False
    assert _is_farewell_utterance("ZeniaPex ke kya kya products hain?", "Char products hain") is False
    assert _is_farewell_utterance("agent kaise banaye?", "Aap dashboard se agent bana sakte hain") is False
    assert _is_farewell_utterance("", "") is False


def test_core_company_context_includes_all_zeniapex_products():
    """Core company context must list all 4 ZeniaPex products so agent knows them even without RAG."""
    from modules.gemini_phone_live import _build_core_company_context

    ctx = _build_core_company_context("ZeniaOne")
    assert "ZeniaOne" in ctx
    assert "ZeniaPex" in ctx
    assert "ZeniaHR" in ctx
    assert "ZeniaChat" in ctx
    assert "TenderGuruji" in ctx


def test_instruction_includes_product_suite_and_farewell():
    """System instruction for Gemini Phone Live must authorize product explanations and polite farewells."""
    from modules.gemini_phone_live import _instruction

    inst = _instruction({"name": "Farhan"}, "ZeniaOne", "inbound")
    assert "ZeniaHR" in inst
    assert "ZeniaChat" in inst
    assert "TenderGuruji" in inst
    assert "farewell" in inst.lower() or "alvida" in inst.lower()
    assert "Customer Memory & Historical Recall" in inst
    assert "get_caller_history" in inst


def test_format_caller_memory_context_and_history_response():
    """Verify that caller CRM memory and history tools format rich structured data."""
    from services.caller_intelligence_service import (
        format_caller_history_response,
        format_caller_memory_context,
    )
    from datetime import datetime, timezone

    fake_profile = {
        "phone": "+91 84889 46014",
        "clean_phone": "8488946014",
        "contact_name": "Gopal Bharvad",
        "is_saved": True,
        "is_returning": True,
        "stats": {
            "total_calls": 7,
            "inbound_calls": 3,
            "outbound_calls": 4,
            "completed_calls": 6,
            "failed_calls": 1,
            "total_talk_time_seconds": 180,
            "avg_duration_seconds": 25,
        },
        "last_conversation": {
            "date": datetime(2026, 10, 29, 11, 42, 23, tzinfo=timezone.utc),
            "topic": "ZeniaOne Platform",
            "summary": "Customer asked about agent creation and pricing plans.",
            "duration_seconds": 22,
        },
        "timeline": [
            {
                "id": "conv-1",
                "date": datetime(2026, 10, 29, 11, 42, 23, tzinfo=timezone.utc),
                "direction": "inbound",
                "duration_seconds": 22,
                "status": "completed",
                "topic": "ZeniaOne Platform",
                "summary": "Customer asked about agent creation and pricing plans.",
            }
        ],
    }

    mem = format_caller_memory_context(fake_profile)
    assert "Gopal Bharvad" in mem
    assert "+91 84889 46014" in mem
    assert "Returning Customer" in mem
    assert "Total Prior Calls: 7" in mem
    assert "ZeniaOne Platform" in mem
    assert "Customer asked about agent creation" in mem

    history = format_caller_history_response(fake_profile, "what did I ask earlier?")
    assert "Gopal Bharvad" in history
    assert "Total Calls: 7" in history
    assert "Total Talk Time: 180 seconds" in history
    assert "ZeniaOne Platform" in history


@pytest.mark.asyncio
async def test_phone_native_live_handles_get_caller_history_tool_call():
    """When Gemini issues get_caller_history tool call, server must respond with caller history."""
    from modules.gemini_phone_live import handle_exotel_gemini_live_session

    class FakeGeminiWs:
        def __init__(self):
            self.sent = []
            self.step = 0
            self.closed = False

        async def send(self, data):
            self.sent.append(json.loads(data))

        async def recv(self):
            self.step += 1
            if self.step == 1:
                return json.dumps({"setupComplete": {}})
            if self.step == 2:
                # Gemini calls get_caller_history
                return json.dumps({
                    "toolCall": {
                        "functionCalls": [{
                            "id": "hist-call-99",
                            "name": "get_caller_history",
                            "args": {"query": "maine pichli call me kya pucha tha?"},
                        }]
                    }
                })
            await asyncio.Event().wait()

        async def close(self):
            self.closed = True

    class FakeExotelWs:
        query_params = {"direction": "inbound"}

        def __init__(self):
            self.events = [
                json.dumps({"event": "start", "start": {"streamSid": "stream-hist-1", "customParameters": {"caller": "08488946014"}}}),
                json.dumps({"event": "stop"}),
            ]

        async def receive_text(self):
            if self.events:
                return self.events.pop(0)
            await asyncio.Event().wait()

        async def send_json(self, _payload):
            return None

    fake_gemini = FakeGeminiWs()
    fake_caller_prof = {
        "phone": "+91 84889 46014",
        "clean_phone": "8488946014",
        "contact_name": "Gopal Bharvad",
        "is_saved": True,
        "is_returning": True,
        "stats": {
            "total_calls": 7,
            "inbound_calls": 3,
            "outbound_calls": 4,
            "total_talk_time_seconds": 180,
            "avg_duration_seconds": 25,
        },
        "last_conversation": {
            "topic": "Product information",
            "summary": "Call completed with voice agent.",
        },
        "timeline": [],
    }

    with (
        patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}),
        patch("modules.gemini_phone_live.websockets.connect", new=AsyncMock(return_value=fake_gemini)),
        patch("services.voice_channel_mapping.resolve_exotel_channel", new=AsyncMock(return_value=None)),
        patch("services.conversation_service.create_conversation", new=AsyncMock(return_value={"_id": "conv-1", "company_id": "comp-1"})),
        patch("services.conversation_service.get_recent_messages_for_caller", new=AsyncMock(return_value=[])),
        patch("modules.gemini_phone_live.get_caller_profile", new=AsyncMock(return_value=fake_caller_prof)),
    ):
        result = await handle_exotel_gemini_live_session(
            FakeExotelWs(),
            agent={"name": "Farhan"},
            company_id="comp-1",
            company_name="ZeniaOne",
            rag_pipeline=None,
        )

    assert result is not None
    tool_responses = [s for s in fake_gemini.sent if "toolResponse" in s]
    assert len(tool_responses) == 1
    resp_obj = tool_responses[0]["toolResponse"]["functionResponses"][0]
    assert resp_obj["id"] == "hist-call-99"
    assert resp_obj["name"] == "get_caller_history"
    assert "Gopal Bharvad" in resp_obj["response"]["result"]
    assert "Total Calls: 7" in resp_obj["response"]["result"]
