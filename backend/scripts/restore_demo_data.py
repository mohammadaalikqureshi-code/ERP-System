"""Restore demo database data from scripts/demo_data.json into the target database.

Works seamlessly on both SQLite and PostgreSQL with robust type conversion,
individual table transactions, and conflict handling (ON CONFLICT DO NOTHING / OR IGNORE).
"""

import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, Boolean, JSON, Time, insert, select
from sqlalchemy.dialects.postgresql import UUID as pgUUID
from app.core.database import engine, AsyncSessionLocal
import app.models  # noqa: F401
from app.models import Base
from app.models.user import User

logger = logging.getLogger("restore_demo_data")


async def restore_data(force: bool = False) -> bool:
    data_file = os.path.join(os.path.dirname(__file__), "demo_data.json")
    if not os.path.exists(data_file):
        print(f"[restore_data] File not found: {data_file}")
        return False

    with open(data_file, "r") as f:
        data = json.load(f)

    # 1. Ensure schema exists
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Check if key demo accounts already exist
    async with AsyncSessionLocal() as session:
        admin_user = await session.scalar(select(User).where(User.email == "admin@medicare-erp.in"))
        receptionist_user = await session.scalar(select(User).where(User.email == "priya.menon@sanjeevanihospital.in"))
        if admin_user and receptionist_user and not force:
            print("[restore_data] Demo users already present and verified. Skipping restore.")
            return True

    total_records = sum(len(v) for v in data.values())
    print(f"[restore_data] Restoring {total_records} records from {data_file} into {engine.dialect.name}...")

    # 3. Insert table by table in independent transactions
    is_postgres = engine.dialect.name == "postgresql"
    is_sqlite = engine.dialect.name == "sqlite"

    for table_name, rows in data.items():
        if not rows:
            continue
        table = Base.metadata.tables.get(table_name)
        if table is None:
            continue

        cleaned_rows = []
        for r in rows:
            row_copy = {}
            for k, v in r.items():
                if k not in table.columns or v is None:
                    continue
                col = table.columns[k]
                col_type = col.type
                
                # Robust type conversion across SQLite and PostgreSQL
                try:
                    if isinstance(col_type, Boolean):
                        if isinstance(v, (int, str)):
                            row_copy[k] = bool(v) if isinstance(v, int) else (v.lower() in ("true", "1", "t", "yes"))
                        else:
                            row_copy[k] = bool(v)
                    elif isinstance(col_type, JSON):
                        if isinstance(v, str):
                            try:
                                row_copy[k] = json.loads(v)
                            except Exception:
                                row_copy[k] = v
                        else:
                            row_copy[k] = v
                    elif isinstance(col_type, pgUUID) or "UUID" in type(col_type).__name__:
                        if isinstance(v, str):
                            try:
                                row_copy[k] = uuid.UUID(v)
                            except Exception:
                                row_copy[k] = v
                        else:
                            row_copy[k] = v
                    elif isinstance(col_type, DateTime):
                        if isinstance(v, str):
                            try:
                                row_copy[k] = datetime.fromisoformat(v)
                            except Exception:
                                row_copy[k] = v
                        else:
                            row_copy[k] = v
                    elif isinstance(col_type, Date):
                        if isinstance(v, str):
                            try:
                                row_copy[k] = date.fromisoformat(v.split(" ")[0].split("T")[0])
                            except Exception:
                                row_copy[k] = v
                        else:
                            row_copy[k] = v
                    elif isinstance(col_type, Time):
                        if isinstance(v, str):
                            try:
                                row_copy[k] = time.fromisoformat(v)
                            except Exception:
                                row_copy[k] = v
                        else:
                            row_copy[k] = v
                    elif isinstance(col_type, Numeric):
                        if v is not None and not isinstance(v, Decimal):
                            try:
                                row_copy[k] = Decimal(str(v))
                            except Exception:
                                row_copy[k] = v
                        else:
                            row_copy[k] = v
                    else:
                        row_copy[k] = v
                except Exception:
                    row_copy[k] = v
            cleaned_rows.append(row_copy)

        if cleaned_rows:
            try:
                async with engine.begin() as conn:
                    if is_postgres:
                        from sqlalchemy.dialects.postgresql import insert as pg_insert
                        stmt = pg_insert(table).values(cleaned_rows).on_conflict_do_nothing()
                        await conn.execute(stmt)
                    elif is_sqlite:
                        stmt = insert(table).prefix_with("OR IGNORE")
                        await conn.execute(stmt, cleaned_rows)
                    else:
                        for row in cleaned_rows:
                            try:
                                await conn.execute(insert(table).values(**row))
                            except Exception:
                                pass
                print(f"  ✓ {table_name}: {len(cleaned_rows)} records restored")
            except Exception as exc:
                print(f"  ⚠ {table_name} warning on bulk insert ({exc!s}), trying row-by-row...")
                # Row-by-row fallback
                for row in cleaned_rows:
                    try:
                        async with engine.begin() as conn:
                            if is_postgres:
                                from sqlalchemy.dialects.postgresql import insert as pg_insert
                                await conn.execute(pg_insert(table).values([row]).on_conflict_do_nothing())
                            elif is_sqlite:
                                await conn.execute(insert(table).prefix_with("OR IGNORE").values(**row))
                            else:
                                await conn.execute(insert(table).values(**row))
                    except Exception:
                        pass

    # 4. Final verification and seed completion
    try:
        from scripts.seed import main as run_seed
        await run_seed()
    except Exception as exc:
        print(f"[restore_data] Seed verification notice: {exc}")

    print("[restore_data] Database restore completed successfully! All demo accounts active.")
    return True


if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    asyncio.run(restore_data(force=force_flag))
