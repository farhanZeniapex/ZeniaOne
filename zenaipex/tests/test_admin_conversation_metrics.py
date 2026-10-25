from api.v1.admin.conversations import _source_type


def test_reconstructed_direction_does_not_prove_a_web_chat():
    assert _source_type({
        "direction": "web_chat",
        "caller_phone": "Unknown Number",
        "call_sid": None,
    }) == "web_chat"


def test_provider_calls_and_identified_chat_sessions_are_separate():
    assert _source_type({"direction": "inbound", "call_sid": "provider-sid"}) == "phone_call"
    assert _source_type({"direction": "test-chat", "caller_phone": None}) == "web_chat"
    assert _source_type({"direction": "test-voice-chat", "caller_phone": None}) == "voice_chat"
