"""Small optional shared-cache adapter with a safe in-process fallback."""
import json
import logging
from typing import Any, Optional

from core.config import settings

logger = logging.getLogger(__name__)
_redis_client = None
_redis_disabled = False


async def _client():
    global _redis_client, _redis_disabled
    if _redis_disabled or not settings.redis_url:
        return None
    if _redis_client is None:
        try:
            from redis.asyncio import Redis
            _redis_client = Redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            await _redis_client.ping()
        except Exception as exc:
            _redis_disabled = True
            _redis_client = None
            logger.warning("Shared Redis cache unavailable; using local cache: %s", exc)
    return _redis_client


async def get_json(key: str) -> Optional[Any]:
    client = await _client()
    if not client:
        return None
    try:
        value = await client.get(key)
        return json.loads(value) if value else None
    except Exception as exc:
        logger.debug("Redis cache read failed for %s: %s", key, exc)
        return None


async def set_json(key: str, value: Any, ttl_seconds: Optional[int] = None) -> bool:
    client = await _client()
    if not client:
        return False
    try:
        ttl = ttl_seconds or settings.redis_cache_ttl_seconds
        await client.set(key, json.dumps(value), ex=ttl)
        return True
    except Exception as exc:
        logger.debug("Redis cache write failed for %s: %s", key, exc)
        return False


async def close() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
