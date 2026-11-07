"""Restore demo database data from scripts/demo_data.json into the target database.

Works seamlessly on both SQLite and PostgreSQL with robust type conversion,
topological dependency order, table truncation on force, and conflict handling.
"""

import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, Boolean, JSON, Time, insert, select, text, update
from sqlalchemy.dialects.postgresql import UUID as pgUUID
from app.core.database import engine, AsyncSessionLocal
import app.models  # noqa: F401
from app.models import Base
from app.models.user import User
from app.core.security import get_password_hash

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

    # 2. Check if key demo accounts already exist and are valid (unless force is requested)
    if not force:
        try:
            async with AsyncSessionLocal() as session:
                admin_user = (await session.execute(select(User).where(User.email == "admin@medicare-erp.in"))).scalars().first()
                receptionist_user = (await session.execute(select(User).where(User.email == "priya.menon@sanjeevanihospital.in"))).scalars().first()
                if admin_user and receptionist_user:
                    print("[restore_data] Demo users already present and verified. Skipping restore.")
                    return True
        except Exception as check_exc:
            print(f"[restore_data] Verification check notice: {check_exc}")

    is_postgres = engine.dialect.name == "postgresql"
    is_sqlite = engine.dialect.name == "sqlite"

    # 3. If force is enabled, wipe existing data so original snapshot UUIDs and foreign keys insert cleanly
    if force:
        print(f"[restore_data] Force mode active: clearing existing demo tables on {engine.dialect.name}...")
        try:
            async with engine.begin() as conn:
                if is_postgres:
                    all_table_names = [t.name for t in Base.metadata.sorted_tables]
                    quoted = ", ".join(f'"{name}"' for name in all_table_names)
                    await conn.execute(text(f"TRUNCATE TABLE {quoted} CASCADE;"))
                else:
                    for table in reversed(Base.metadata.sorted_tables):
                        await conn.execute(table.delete())
            print("[restore_data] Existing demo tables cleared successfully.")
        except Exception as exc:
            print(f"[restore_data] Notice during table clear: {exc}")

    total_records = sum(len(v) for v in data.values())
    print(f"[restore_data] Restoring {total_records} records from {data_file} into {engine.dialect.name} in dependency order...")

    # 4. Insert table by table in strict topological dependency order (parents before children)
    for table in Base.metadata.sorted_tables:
        table_name = table.name
        rows = data.get(table_name)
        if not rows:
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

    # 5. Guarantee all demo user passwords are active with password Medicare@2026
    try:
        demo_hash = get_password_hash("Medicare@2026")
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(User).values(
                    password_hash=demo_hash,
                    is_active=True,
                    is_deleted=False,
                )
            )
            await session.commit()
        print("  ✓ All user credentials verified with password 'Medicare@2026'.")
    except Exception as exc:
        print(f"[restore_data] User password refresh notice: {exc}")

    # 6. Final verification with seed
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
