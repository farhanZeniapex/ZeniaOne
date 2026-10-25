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


@pytest.mark.asyncio
async def test_shared_cache_writes_and_increments_with_client():
    class FakeRedis:
        def __init__(self):
            self.values = {}
            self.expiries = {}

        async def set(self, key, value, ex):
            self.values[key] = value
            self.expiries[key] = ex

        async def incr(self, key):
            self.values[key] = int(self.values.get(key, 0)) + 1
            return self.values[key]

        async def expire(self, key, ttl):
            self.expiries[key] = ttl

    fake = FakeRedis()
    async def fake_client():
        return fake
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(cache, "_client", fake_client)
    try:
        assert await cache.set_json("snapshot", {"ok": True}, ttl_seconds=9)
        assert await cache.increment("counter", 12) == 1
        assert await cache.increment("counter", 12) == 2
        assert fake.expiries["snapshot"] == 9
        assert fake.expiries["counter"] == 12
    finally:
        monkeypatch.undo()
