import pytest

from zenaipex.core import cache


@pytest.mark.asyncio
async def test_shared_cache_is_optional_without_redis_url():
    original_url = cache.settings.redis_url
    try:
        cache.settings.redis_url = ""
        assert await cache.get_json("missing") is None
        assert await cache.set_json("key", {"value": 1}) is False
    finally:
        cache.settings.redis_url = original_url
