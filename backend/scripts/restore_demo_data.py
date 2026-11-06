"""Restore demo database data from scripts/demo_data.json into the target database.

Works seamlessly on both SQLite and PostgreSQL.
"""

import asyncio
import json
import os
import sys
import uuid
from datetime import date, datetime, time

from sqlalchemy import insert, select
from app.core.database import engine, AsyncSessionLocal
import app.models  # noqa: F401
from app.models import Base
from app.models.user import User


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

    # 2. Check if users already exist
    async with AsyncSessionLocal() as session:
        has_user = await session.scalar(select(User).limit(1))
        if has_user and not force:
            print("[restore_data] Database already contains users. Skipping restore (force=False).")
            return True

    print(f"[restore_data] Restoring {sum(len(v) for v in data.values())} records from {data_file}...")

    # 3. Insert table by table
    async with engine.begin() as conn:
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
                    if k not in table.columns:
                        continue
                    col = table.columns[k]
                    # Convert types appropriately
                    if str(col.type) == "BOOLEAN" and isinstance(v, int):
                        v = bool(v)
                    elif "JSON" in str(col.type) and isinstance(v, str):
                        try:
                            v = json.loads(v)
                        except Exception:
                            pass
                    elif "UUID" in str(col.type) and isinstance(v, str):
                        try:
                            v = uuid.UUID(v)
                        except Exception:
                            pass
                    elif "DATETIME" in str(col.type) and isinstance(v, str):
                        try:
                            v = datetime.fromisoformat(v)
                        except Exception:
                            pass
                    elif "DATE" in str(col.type) and isinstance(v, str):
                        try:
                            v = date.fromisoformat(v)
                        except Exception:
                            pass
                    elif "TIME" in str(col.type) and isinstance(v, str):
                        try:
                            v = time.fromisoformat(v)
                        except Exception:
                            pass
                    row_copy[k] = v
                cleaned_rows.append(row_copy)

            if cleaned_rows:
                try:
                    await conn.execute(insert(table), cleaned_rows)
                    print(f"  ✓ {table_name}: {len(cleaned_rows)} records restored")
                except Exception as exc:
                    print(f"  ⚠ {table_name} warning: {exc}")

    print("[restore_data] Database restore completed successfully!")
    return True


if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    asyncio.run(restore_data(force=force_flag))
