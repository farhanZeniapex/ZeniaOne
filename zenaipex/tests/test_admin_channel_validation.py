import pytest
from pydantic import ValidationError

from api.v1.admin.channels import CreateChannelRequest
from api.v1.channels_twilio import _twilio_websocket_external_url


def test_admin_channel_request_normalizes_phone_number():
    body = CreateChannelRequest(
        name=" Main line ",
        type="twilio_voice",
        phone_number=" +91 98765-43210 ",
        company_id="company-1",
    )
    assert body.name == "Main line"
    assert body.phone_number == "+919876543210"


def test_admin_channel_request_rejects_invalid_phone_number():
    with pytest.raises(ValidationError, match="Invalid phone number"):
        CreateChannelRequest(
            name="Main line",
            type="twilio_voice",
            phone_number="123",
            company_id="company-1",
        )


def test_twilio_websocket_signature_url_maps_render_proxy_scheme():
    assert _twilio_websocket_external_url(
        "ws://10.0.0.4:8002/api/v1/webhook/twilio/media-stream",
        "zeniaone-backend.onrender.com",
        "https",
    ) == "wss://zeniaone-backend.onrender.com/api/v1/webhook/twilio/media-stream"
