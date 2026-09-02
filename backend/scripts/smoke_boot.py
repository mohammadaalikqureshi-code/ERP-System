"""Boot the real ASGI app (every router, my AI/api_keys changes included) and
hit the no-I/O health probe — proves the app imports and serves without a
Postgres/Redis stack. Uses in-memory SQLite so nothing external is needed.

    .venv/Scripts/python.exe -m scripts.smoke_boot
"""
import os

os.environ["ENVIRONMENT"] = "development"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["RATE_LIMIT_ENABLED"] = "False"
os.environ["CACHE_ENABLED"] = "False"
os.environ["AI_PROVIDER"] = "groq"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

with TestClient(app) as client:
    health = client.get("/api/v1/health")
    print("GET /api/v1/health ->", health.status_code, health.json())
    ready = client.get("/api/v1/ready")
    print("GET /api/v1/ready  ->", ready.status_code, ready.json())
    openapi = client.get("/openapi.json")
    paths = openapi.json().get("paths", {})
    ai_paths = sorted(p for p in paths if "/ai" in p or "api-keys" in p or "/panels" in p)
    print(f"\nApp exposes {len(paths)} routes. AI / API-key / panel routes:")
    for p in ai_paths:
        print("  ", p)

print("\nSMOKE BOOT OK — the full app imported and served requests.")
