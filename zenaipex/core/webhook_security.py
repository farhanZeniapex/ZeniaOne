"""Small, provider-agnostic webhook verification helpers."""
import hashlib
import hmac
import time
from urllib.parse import urlencode

from fastapi import HTTPException, Request


def build_signed_callback_query(secret: str, value: str, *, timestamp: int | None = None) -> str:
    """Create a short-lived query signature for providers that send no header."""
    ts = int(timestamp if timestamp is not None else time.time())
    digest = hmac.new(
        (secret or "").encode(), f"{value}:{ts}".encode(), hashlib.sha256
    ).hexdigest()
    return urlencode({"ts": ts, "sig": digest})


def _verify_signed_callback_query(
    request: Request, secret: str, value: str, *, max_age_seconds: int = 86400
) -> bool:
    supplied = request.query_params.get("sig", "")
    raw_timestamp = request.query_params.get("ts", "")
    try:
        timestamp = int(raw_timestamp)
    except (TypeError, ValueError):
        return False
    if abs(int(time.time()) - timestamp) > max_age_seconds:
        return False
    expected = hmac.new(
        (secret or "").encode(), f"{value}:{timestamp}".encode(), hashlib.sha256
    ).hexdigest()
    return bool(supplied) and hmac.compare_digest(supplied, expected)


async def require_hmac_webhook(
    request: Request,
    secret: str,
    *,
    provider: str,
    signed_value: str | None = None,
) -> bytes:
    """Validate X-ZeniaOne-Signature over the raw request body.

    Production webhooks fail closed when no secret is configured. Development
    keeps the endpoint usable for local provider emulators, but still verifies
    a signature whenever a secret is supplied.
    """
    body = await request.body()
    signature = request.headers.get("x-zeniaone-signature", "")
    expected = hmac.new((secret or "").encode(), body, hashlib.sha256).hexdigest() if secret else ""
    from core.config import settings
    if settings.is_production and not secret:
        raise HTTPException(status_code=503, detail=f"{provider} webhook secret is not configured")
    header_valid = bool(secret and signature) and hmac.compare_digest(str(signature), expected)
    query_valid = bool(signed_value) and _verify_signed_callback_query(
        request, secret, signed_value or ""
    )
    if secret and not (header_valid or query_valid):
        raise HTTPException(status_code=401, detail=f"Invalid {provider} webhook signature")
    return body


def require_hmac_value(value: str, signature: str, secret: str, *, provider: str) -> None:
    """Validate a signature supplied during a WebSocket handshake."""
    from core.config import settings
    expected = hmac.new((secret or "").encode(), value.encode(), hashlib.sha256).hexdigest() if secret else ""
    if settings.is_production and not secret:
        raise HTTPException(status_code=503, detail=f"{provider} webhook secret is not configured")
    if secret and (not signature or not hmac.compare_digest(signature, expected)):
        raise HTTPException(status_code=401, detail=f"Invalid {provider} webhook signature")
