"""Regression coverage for Exotel call-attempt and talk-time handling."""

from pathlib import Path
import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.mark.asyncio
async def test_call_attempt_without_status_does_not_complete_conversation():
    from api.v1.voice_advanced import exotel_status_webhook

    request = MagicMock()
    request.method = "POST"
    request.query_params = {"channel_id": "channel-1"}
    request.form = AsyncMock(return_value={
        "CallSid": "attempt-1",
        "CallType": "call-attempt",
        "DialCallDuration": "0",
    })

    with patch("core.webhook_security.require_hmac_webhook", new=AsyncMock()), \
         patch("core.database.col_conversations") as conversations:
        result = await exotel_status_webhook("company-1", "agent-1", request)

    assert result == {"status": "ok", "ignored": "call-attempt"}
    conversations.return_value.update_one.assert_not_called()


@pytest.mark.asyncio
async def test_terminal_status_prefers_zero_dial_talk_time():
    from api.v1.voice_advanced import exotel_status_webhook

    request = MagicMock()
    request.method = "POST"
    request.query_params = {"channel_id": "channel-1"}
    request.form = AsyncMock(return_value={
        "CallSid": "terminal-1",
        "Status": "completed",
        "Duration": "25",
        "DialCallDuration": "0",
    })
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value=None)
    collection.update_one = AsyncMock()

    with patch("core.webhook_security.require_hmac_webhook", new=AsyncMock()), \
         patch("core.database.col_conversations", return_value=collection):
        result = await exotel_status_webhook("company-1", "agent-1", request)

    assert result == {"status": "ok"}
    update = collection.update_one.call_args.args[1]["$set"]
    assert update["status"] == "completed"
    assert update["duration_seconds"] == 0


@pytest.mark.asyncio
async def test_voicebot_returns_signed_websocket_when_database_lookup_times_out():
    from api.v1.voice_advanced import exotel_voicebot_webhook

    company_id = "company-1"
    agent_id = "6adde170093109b716737af6"
    request = MagicMock()
    request.method = "GET"
    request.query_params = {
        "channel_id": "channel-1",
        "CallSid": "call-1",
        "CallFrom": "07600858654",
        "CallTo": "09513886363",
    }
    request.headers = {"host": "voice.example.com"}

    agents = MagicMock()
    agents.find_one = AsyncMock(side_effect=asyncio.TimeoutError())

    with patch("core.webhook_security.require_hmac_webhook", new=AsyncMock()), \
         patch("core.database.col_agents", return_value=agents), \
         patch("services.voice_channel_mapping.resolve_exotel_channel", new=AsyncMock(side_effect=asyncio.TimeoutError())), \
         patch("services.conversation_service.create_conversation", new=AsyncMock()):
        response = await exotel_voicebot_webhook(company_id, agent_id, request)

    assert response.status_code == 200
    body = response.body.decode("utf-8")
    assert "wss://voice.example.com/api/v1/webhook/exotel/advanced/" in body
    assert "channel_id=channel-1" in body
    assert "signature=" in body

