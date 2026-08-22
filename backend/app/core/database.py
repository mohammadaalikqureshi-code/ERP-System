"""Database engine and session factory.

Pool sizing comes from settings so it can be tuned per environment: a single
small VM and a horizontally-scaled deployment want very different numbers.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# SQLite (used by the test suite) has no connection pool to size, and passing
# pool arguments to it is an error — so only send them to a real server.
_pool_options = (
    {}
    if settings.DATABASE_URL.startswith("sqlite")
    else {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        # Recycle connections periodically so a proxy or firewall dropping idle
        # sockets does not surface as a random query failure.
        "pool_recycle": settings.DB_POOL_RECYCLE,
        "pool_pre_ping": True,
    }
)

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, **_pool_options)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db():
    """FastAPI dependency yielding a session that always gets closed."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def check_database() -> bool:
    """True if the database answers a trivial query. Used by the readiness probe."""
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
