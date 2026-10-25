import pytest
import os
from unittest.mock import AsyncMock, patch, MagicMock
from modules.gemini_live import (
    is_gemini_live_available,
    get_gemini_api_key,
    PREBUILT_VOICES,
    handle_gemini_live_session
)

def test_gemini_live_availability():
    with patch.dict(os.environ, {"GEMINI_API_KEY": "test_key_123"}):
        assert is_gemini_live_available() is True
        assert get_gemini_api_key() == "test_key_123"

def test_prebuilt_voices_catalog():
    assert "aoede" in PREBUILT_VOICES
    assert "puck" in PREBUILT_VOICES
    assert "charon" in PREBUILT_VOICES
    assert PREBUILT_VOICES["aoede"] == "Aoede"
    assert PREBUILT_VOICES["puck"] == "Puck"

@pytest.mark.asyncio
async def test_handle_gemini_live_missing_key():
    client_ws = AsyncMock()
    with patch.dict(os.environ, {"GEMINI_API_KEY": "", "GOOGLE_API_KEY": ""}):
        await handle_gemini_live_session(
            client_ws=client_ws,
            agent={"name": "Test"},
            company_id="comp_1",
            user_id="user_1"
        )
        client_ws.send_json.assert_called_once_with({
            "type": "error",
            "message": "Gemini Live API key not configured."
        })
