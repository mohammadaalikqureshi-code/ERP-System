# Deploying MediCare ERP (no Docker required)

The app runs on plain **Python + Node** — Docker is **not** required to deploy or
to run it. Docker is still available for local convenience (`docker compose up`),
but nothing depends on it.

What used to make Docker feel mandatory, and how each is handled now:

| Was Docker-only | Now |
|---|---|
| WeasyPrint's Pango/Cairo libs for PDFs | App runs without them; PDF endpoints return a clear **503 "not available here"** instead of crashing. Install the libs (or use Docker) to enable PDFs. |
| Redis for cache / rate-limit / realtime | **Optional.** Without Redis: caching is skipped, rate-limiting fails open, and realtime is delivered in-process (fine on a single instance). |
| A pre-formatted Fernet `ENCRYPTION_KEY` | Any value works — a valid Fernet key is derived from whatever you set, so Render's auto-generated secret is fine. |
| Running migrations / seeding | Done by `backend/render_start.sh` on boot (`alembic upgrade head`, then seed when `SEED_ON_STARTUP=true`). |

---

## Deploy to Render (Blueprint — native, no Docker)

1. Push this repo to GitHub.
2. In Render → **New +** → **Blueprint** → pick the repo. Render reads
   [`render.yaml`](render.yaml) and creates: a managed **Postgres** database, the
   **Python API** service, and the **static frontend** site — all on native
   runtimes (no Docker image is built).
3. First boot runs migrations and seeds the demo clinic automatically
   (`SEED_ON_STARTUP=true`). Set that env var to `false` afterwards to speed up
   restarts.
4. Turn on the AI assistant: open the **medicare-erp-api** service → **Environment**
   → set `AI_API_KEY` to your Groq key (`gsk_…` from
   <https://console.groq.com/keys>) — or leave it blank and add the key in-app
   under **Admin → API Keys**. Then, in the app, **Panels → AI Assistant → on**.

Sign in (seeded): clinic admin `neha.kulkarni@sanjeevanihospital.in` /
`Medicare@2026`. Full credential list is in the [README](README.md).

**URLs / names.** The blueprint names the services `medicare-erp-api` and
`medicare-erp-web`; the frontend auto-points at the API from that `-web`→`-api`
naming. If you rename either, update `ALLOWED_ORIGINS` on the API and, if needed,
`VITE_API_BASE_URL` on the web service.

**Environment.** It deploys as `staging`: secure cross-site cookies (so login
works across the two `onrender.com` subdomains) without the strict production
secret checks, and OTP is returned in the API response so patient sign-in works
without an SMS gateway. Switch to `production` once you set real secrets and an
SMS provider.

---

## Run locally without Docker

Needs **Python 3.11+**, **Node 20+**, and a **PostgreSQL 15+** (Redis optional).

```bash
# backend
cd backend
python -m venv .venv && . .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                                   # set DATABASE_URL to your Postgres
SEED_ON_STARTUP=true bash render_start.sh              # migrate + seed + serve on :8000
```

```bash
# frontend (second terminal)
cd frontend
npm install
npm run dev                                            # http://localhost:5173
```

Notes:
- **No Redis?** Fine — the app logs "single-instance mode" and keeps working.
- **PDF downloads** (prescriptions, receipts, lab reports) need WeasyPrint's
  system libraries (Pango/Cairo). Without them those endpoints return 503; see
  the [README](README.md) for the per-OS install, or use `docker compose up`.
