"""Test fixtures.

The tests run against SQLite in memory so they need no Postgres, no Redis and
no network. Anything genuinely Postgres-specific is covered by the integration
checks in CI instead.
"""

import asyncio
import os

import pytest

# Point the app at throwaway settings before anything imports `settings`.
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("SECRET_KEY", "test-secret-key-used-only-by-the-test-suite")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key-used-only-by-tests")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test-refresh-secret-used-only-by-tests")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("RATE_LIMIT_ENABLED", "False")
os.environ.setdefault("CACHE_ENABLED", "False")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
