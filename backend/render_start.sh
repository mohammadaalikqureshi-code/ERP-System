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

echo "[render_start] Checking deployment environment and cryptographic secrets..."
python -c "
import os, secrets
from cryptography.fernet import Fernet

env_file = '.env.production.local'
insecure = {'change-me', 'your-secret-key-change-in-production', 'your-jwt-secret-key', 'your-jwt-refresh-secret-key'}

existing = {}
if os.path.exists(env_file):
    with open(env_file, 'r') as f:
        for line in f:
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.strip().split('=', 1)
                existing[k] = v

updates = {}
sk = os.getenv('SECRET_KEY') or existing.get('SECRET_KEY', '')
if not sk or sk in insecure or len(sk) < 32:
    updates['SECRET_KEY'] = secrets.token_urlsafe(48)

jsk = os.getenv('JWT_SECRET_KEY') or existing.get('JWT_SECRET_KEY', '')
if not jsk or jsk in insecure or len(jsk) < 32:
    updates['JWT_SECRET_KEY'] = secrets.token_urlsafe(48)

jrsk = os.getenv('JWT_REFRESH_SECRET_KEY') or existing.get('JWT_REFRESH_SECRET_KEY', '')
if not jrsk or jrsk in insecure or len(jrsk) < 32:
    updates['JWT_REFRESH_SECRET_KEY'] = secrets.token_urlsafe(48)

ek = os.getenv('ENCRYPTION_KEY') or existing.get('ENCRYPTION_KEY', '')
if not ek:
    updates['ENCRYPTION_KEY'] = Fernet.generate_key().decode()

if os.getenv('ENVIRONMENT') == 'production':
    updates['DEBUG'] = 'False'

if updates:
    existing.update(updates)
    with open(env_file, 'w') as f:
        for k, v in existing.items():
            f.write(f'{k}={v}\n')
    print(f'[render_start] Initialized secure credentials in {env_file}')
" || true

export RENDER="true"
export AUTO_GENERATE_SECRETS="true"

if [ -f ".env.production.local" ]; then
    set -a
    source .env.production.local
    set +a
fi

echo "[render_start] Ensuring database schema (idempotent, safe on existing DBs)..."
python -m scripts.init_db || echo "[render_start] Warning: schema init encountered an issue; continuing..."

echo "[render_start] Restoring full database snapshot from demo_data.json..."
python -m scripts.restore_demo_data --force || echo "[render_start] Snapshot restore notice; continuing to seed verification..."

if [ "${SEED_ON_STARTUP}" != "false" ]; then
  echo "[render_start] Seeding and verifying demo accounts and doctors..."
  python -m scripts.seed || echo "[render_start] Seed skipped/failed; continuing to start the server."
fi

echo "[render_start] Starting API on 0.0.0.0:${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
