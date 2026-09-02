#!/usr/bin/env bash
# Native (no-Docker) startup used by Render — and by anyone running the API on a
# plain Python host. It does the three things a container's entrypoint would:
#
#   1. ensure the database schema  (idempotent create_all — this project's
#                                   schema is model-driven, not Alembic-driven)
#   2. optionally seed demo data   (only when SEED_ON_STARTUP=true)
#   3. start the API server
#
# Run locally with:  bash render_start.sh
set -e

echo "[render_start] Ensuring database schema (idempotent, safe on existing DBs)..."
python -m scripts.init_db

if [ "${SEED_ON_STARTUP}" = "true" ]; then
  echo "[render_start] SEED_ON_STARTUP=true — seeding demo data (idempotent)..."
  python -m scripts.seed || echo "[render_start] Seed skipped/failed; continuing to start the server."
fi

echo "[render_start] Starting API on 0.0.0.0:${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
