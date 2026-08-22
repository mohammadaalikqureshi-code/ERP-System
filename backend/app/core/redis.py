"""Redis connection pool.

One pool is shared by the whole process. Redis is used for three things:
rate limiting, short-lived caching, and broadcasting queue updates between
workers so every connected browser sees the same live queue.
"""

from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings

redis_pool = ConnectionPool(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    password=settings.REDIS_PASSWORD or None,
    db=settings.REDIS_DB,
    max_connections=settings.REDIS_MAX_CONNECTIONS,
    decode_responses=True,
)


def get_redis() -> Redis:
    """FastAPI dependency: a Redis client backed by the shared pool."""
    return Redis(connection_pool=redis_pool)


async def check_redis() -> bool:
    """True if Redis answers a ping. Used by the readiness probe."""
    try:
        return bool(await get_redis().ping())
    except Exception:
        return False
