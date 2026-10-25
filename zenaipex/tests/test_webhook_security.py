from urllib.parse import parse_qs

import pytest
from starlette.requests import Request

from core.webhook_security import (
    _verify_signed_callback_query,
    build_signed_callback_query,
    require_hmac_webhook,
)


def _request(query: str) -> Request:
    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request({
        "type": "http",
        "method": "POST",
        "path": "/webhook",
        "query_string": query.encode(),
        "headers": [],
    }, receive=receive)


def test_signed_callback_query_is_tenant_bound_and_time_limited():
    query = build_signed_callback_query("secret", "exotel:company:agent:channel", timestamp=1_700_000_000)
    request = _request(query)
    assert _verify_signed_callback_query(request, "secret", "exotel:company:agent:channel", max_age_seconds=10**10)
    assert not _verify_signed_callback_query(request, "secret", "exotel:other:agent:channel", max_age_seconds=10**10)
    assert parse_qs(query)["sig"][0]


@pytest.mark.asyncio
async def test_webhook_accepts_signed_query_when_provider_has_no_custom_header():
    value = "exotel:company:agent:channel"
    query = build_signed_callback_query("secret", value)
    body = await require_hmac_webhook(
        _request(query), "secret", provider="Exotel", signed_value=value
    )
    assert body == b""
