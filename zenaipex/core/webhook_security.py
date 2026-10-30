"""Small, provider-agnostic webhook verification helpers."""
import hashlib
import hmac
import time
from urllib.parse import urlencode

from fastapi import HTTPException, Request


def get_exotel_webhook_secret() -> str:
    """Return the stable platform secret used to sign Exotel callbacks.

    An explicit EXOTEL_WEBHOOK_SECRET remains supported. When it is omitted,
    derive a stable secret from the required field-encryption key so every
    channel can work without asking an end user to edit Render environment
    variables.
    """
    from core.config import settings

    if settings.exotel_webhook_secret:
        return settings.exotel_webhook_secret
    if settings.encryption_key:
        return hmac.new(
            settings.encryption_key.encode("utf-8"),
            b"zeniaone:exotel-webhook:v1",
            hashlib.sha256,
        ).hexdigest()
    return ""


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
    if not isinstance(supplied, str) or not supplied or not secret:
        return False
    raw_timestamp = request.query_params.get("ts", "")
    if raw_timestamp:
        try:
            timestamp = int(raw_timestamp)
            expected = hmac.new(
                secret.encode(), f"{value}:{timestamp}".encode(), hashlib.sha256
            ).hexdigest()
            if hmac.compare_digest(supplied, expected):
                return True
        except (TypeError, ValueError):
            pass
    # Support static tenant-bound token without timestamp for permanent Exotel Applet URLs
    expected_static = hmac.new(
        secret.encode(), value.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(supplied, expected_static)


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
    if not isinstance(body, (bytes, bytearray)):
        body = str(body or "").encode()
    signature = request.headers.get("x-zeniaone-signature", "")
    expected = hmac.new((secret or "").encode(), body, hashlib.sha256).hexdigest() if secret else ""
    from core.config import settings
    if settings.is_production and not secret:
        raise HTTPException(status_code=503, detail=f"{provider} webhook secret is not configured")

    # In development, allow local testing when no signature is supplied
    sig_param = request.query_params.get("sig")
    has_sig = isinstance(sig_param, str) and bool(sig_param.strip())
    has_header = isinstance(signature, str) and bool(signature.strip())
    if not settings.is_production and not has_header and not has_sig:
        return body

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
    if not signature:
        # Carrier WebSocket connections that don't pass a signature query param are permitted in dev/carrier flows
        return
    expected = hmac.new((secret or "").encode(), value.encode(), hashlib.sha256).hexdigest() if secret else ""
    if settings.is_production and not secret:
        raise HTTPException(status_code=503, detail=f"{provider} webhook secret is not configured")
    if secret and not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail=f"Invalid {provider} webhook signature")
