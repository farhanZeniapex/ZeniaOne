import pytest

from zenaipex.core import rate_limit


@pytest.mark.asyncio
async def test_local_rate_limit_rejects_after_limit(monkeypatch):
    rate_limit._local_hits.clear()
    monkeypatch.setattr(rate_limit.settings, "rate_limit_enabled", True)
    monkeypatch.setattr(rate_limit.settings, "redis_url", "")

    assert (await rate_limit.check_rate_limit("test-client", 2))[0] is True
    assert (await rate_limit.check_rate_limit("test-client", 2))[0] is True
    allowed, retry_after = await rate_limit.check_rate_limit("test-client", 2)
    assert allowed is False
    assert retry_after >= 1
