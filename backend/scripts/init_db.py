"""Ensure the database schema exists — the boot-time schema step.

This project creates its schema from the SQLAlchemy models with
``Base.metadata.create_all`` (see ``scripts/seed.py``), not from Alembic, so
that is what we use here too. ``create_all`` is idempotent (it only creates
tables that are missing) and never drops anything, so it is safe to run on every
boot and on an already-populated database.

After the model tables exist, the "market-ready" DDL adds the few extra columns
and tables that are applied with raw ``IF NOT EXISTS`` statements (also
idempotent). The app's lifespan applies the same DDL, but doing it here as well
guarantees every column exists *before* the seed step inserts demo data.

Run with:  python -m scripts.init_db
"""

import asyncio

from app.core.database import engine

# Importing the models package registers every table on Base.metadata.
import app.models  # noqa: F401
from app.models import Base


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[init_db] Base schema ensured (missing tables created).")

    # Extra columns/tables added via raw IF-NOT-EXISTS DDL. Postgres-specific;
    # harmless to skip on databases (e.g. SQLite) that do not support it.
    try:
        from app.migrations.market_ready import run_migration

        await run_migration()
        print("[init_db] Market-ready DDL applied.")
    except Exception as exc:  # noqa: BLE001
        print(f"[init_db] Market-ready DDL skipped ({exc!s}).")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
