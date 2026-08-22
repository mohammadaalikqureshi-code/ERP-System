"""Small Redis cache for read-heavy endpoints.

Dashboards and reports run the same aggregate queries for every user in a
clinic. Caching them for a minute removes most of that database load while
still feeling live.

Usage:
    stats = await cached(f"dashboard:{clinic_id}", ttl=60, loader=compute_stats)
"""

import json
import logging
from typing import Any, Awaitable, Callable, Optional

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)


async def cache_get(key: str) -> Optional[Any]:
    if not settings.CACHE_ENABLED:
        return None
    try:
        raw = await get_redis().get(f"cache:{key}")
        return json.loads(raw) if raw else None
    except Exception:
        logger.warning("Cache read failed for %s", key, exc_info=True)
        return None


async def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> None:
    if not settings.CACHE_ENABLED:
        return
    try:
        await get_redis().setex(
            f"cache:{key}", ttl or settings.CACHE_TTL_SECONDS, json.dumps(value, default=str)
        )
    except Exception:
        logger.warning("Cache write failed for %s", key, exc_info=True)


async def cache_invalidate(pattern: str) -> int:
    """Drop every cached entry matching a pattern, e.g. `dashboard:*`.

    Called after a write so stale numbers are never shown.
    """
    if not settings.CACHE_ENABLED:
        return 0
    try:
        redis = get_redis()
        removed = 0
        async for key in redis.scan_iter(match=f"cache:{pattern}", count=200):
            await redis.delete(key)
            removed += 1
        return removed
    except Exception:
        logger.warning("Cache invalidation failed for %s", pattern, exc_info=True)
        return 0


async def cached(key: str, loader: Callable[[], Awaitable[Any]], ttl: Optional[int] = None) -> Any:
    """Return the cached value for `key`, computing and storing it on a miss."""
    hit = await cache_get(key)
    if hit is not None:
        return hit

    value = await loader()
    await cache_set(key, value, ttl)
    return value
