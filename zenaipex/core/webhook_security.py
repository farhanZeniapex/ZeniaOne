"""Small, provider-agnostic webhook verification helpers."""
import hashlib
import hmac

from fastapi import HTTPException, Request


async def require_hmac_webhook(request: Request, secret: str, *, provider: str) -> bytes:
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
    if secret and (not signature or not hmac.compare_digest(signature, expected)):
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
