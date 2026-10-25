"""Abuse protection with Redis sharing when configured and local fallback."""
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from core.config import settings

_local_hits: Dict[str, Deque[float]] = defaultdict(deque)


async def check_rate_limit(key: str, limit: int, window_seconds: int = 60) -> Tuple[bool, int]:
    """Return (allowed, retry_after_seconds) for a fixed sliding window."""
    if not settings.rate_limit_enabled:
        return True, 0

    # Redis gives a shared counter across Render instances. A local window is
    # deliberately retained as a safe fallback when Redis is not configured.
    try:
        from core.cache import increment
        shared_count = await increment(f"zeniaone:rate:{key}", window_seconds)
    except Exception:
        shared_count = None
    if shared_count is not None:
        return shared_count <= limit, window_seconds if shared_count > limit else 0

    now = time.monotonic()
    hits = _local_hits[key]
    cutoff = now - window_seconds
    while hits and hits[0] <= cutoff:
        hits.popleft()
    if len(hits) >= limit:
        return False, max(1, int(hits[0] + window_seconds - now))
    hits.append(now)
    # Avoid unbounded memory if a scanner rotates IPs.
    if len(_local_hits) > 10_000:
        for stale_key, stale_hits in list(_local_hits.items())[:1_000]:
            if not stale_hits or stale_hits[-1] <= cutoff:
                _local_hits.pop(stale_key, None)
    return True, 0
