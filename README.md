# MediCare — Hospital & Multi-Specialty Clinic ERP

A production-ready ERP for hospitals and multi-specialty clinics: front desk,
consultations and EMR, laboratory, pharmacy, billing, a patient portal, and an
AI assistant that helps with the clinical paperwork.

**Stack:** FastAPI · PostgreSQL · Redis · Celery · React 19 · TypeScript · Vite · Tailwind

---

## What it does

| Panel | For | What it covers |
|---|---|---|
| **Reception** | Front desk | Patient registration, appointment booking, live token queue, billing and GST receipts |
| **Doctor / EMR** | Doctors | Consultation workspace, vitals, medical history, prescriptions, lab orders |
| **Laboratory** | Lab staff | Test catalogue, sample tracking, result entry with reference-range flagging, PDF reports |
| **Pharmacy** | Pharmacists | Stock levels, batches, expiry tracking, reorder alerts, stock movements |
| **Patient portal** | Patients | OTP sign-in, live queue position, own prescriptions and reports |
| **Waiting-room display** | Public screen | Full-screen token board — token numbers only, no patient identities |
| **Administration** | Clinic admin | Staff and doctors, analytics, audit log, panel management, API keys |
| **AI assistant** | All staff | Chat assistant, consultation summaries, prescription safety checks, lab interpretation, daily digest |

Every panel can be switched on or off per clinic from **Administration → Panels**.

---

## Running it

### With Docker (everything at once)

```bash
cp backend/.env.example backend/.env     # then edit the secrets
docker compose up --build

# in a second terminal, once the containers are healthy:
docker compose exec api alembic upgrade head
docker compose exec api python -m scripts.seed
```

Open **http://localhost:3000**.

### Locally, without Docker

You need PostgreSQL 15+, Redis 7+, Python 3.11+ and Node 20+.

```bash
# --- backend -------------------------------------------------------------
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # edit DATABASE_URL etc.

createdb clinic_erp
psql -d clinic_erp -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'

alembic upgrade head
python -m scripts.seed                                # demo clinic + data
uvicorn app.main:app --reload --port 8000

# --- frontend ------------------------------------------------------------
cd ../frontend
npm install
cp .env.example .env
npm run dev                                           # http://localhost:5173
```

WeasyPrint (used for the PDFs) needs Pango and Cairo:

- **Ubuntu/Debian** — `sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0`
- **macOS** — `brew install pango cairo gdk-pixbuf libffi`
- **Windows** — install the [GTK3 runtime](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer)

### Sign-in details after seeding

Every seeded account uses the password **`Medicare@2026`**:

| Role | Email |
|---|---|
| Super admin | `admin@medicare-erp.in` |
| Clinic admin | `neha.kulkarni@sanjeevanihospital.in` |
| Doctor | `meera.raghavan@sanjeevanihospital.in` |
| Receptionist | `priya.menon@sanjeevanihospital.in` |
| Lab technician | `rakesh.kumar@sanjeevanihospital.in` |
| Pharmacist | `imran.qureshi@sanjeevanihospital.in` |

Patient portal: mobile **`9811100001`**. In development the OTP comes back in
the API response, so no SMS gateway is needed.

> **About the demo data.** The clinical reference data is real — laboratory
> reference ranges, generic drug names and strengths, ICD-10 codes and
> department names are all genuine. The hospitals, staff and patients are
> fictional on purpose: demo data naming a real hospital or a real person can
> be mistaken for a real record.

---

## Turning on the AI features

The assistant is off until a key is added, and the app works fully without it.

1. Sign in as a clinic admin → **API Keys**
2. Paste an Anthropic API key → **Save** → **Test** (this makes a real call)
3. **Panels** → switch on **AI Assistant**

The key is encrypted with `ENCRYPTION_KEY` before it is stored and is never
returned by the API — the screen only ever shows `••••••••abcd`. A
platform-wide key can be set with `AI_API_KEY` instead, for single-tenant
installs.

What the assistant does, all from real records in the database:

- **Chat** — ask about a patient's history, a lab value, or how to use the system
- **Consultation summaries** — drafted from the vitals, history and prescription of a visit
- **Prescription safety check** — interactions, recorded allergies, dosing, duplicate therapy, run *before* the doctor signs
- **Lab interpretation** — explains a completed order, flagging what is out of range
- **Triage** — turns a receptionist's free-text note into complaint / duration / urgency / department
- **Daily digest** — an end-of-day operations briefing built from the day's real numbers

Every AI output is stored in `ai_insights`, so suggestions are auditable and
nothing needs regenerating. The prompts live in
`backend/app/modules/ai/prompts.py` — plain text a clinical lead can read and
adjust. They state in every case that the assistant advises and the clinician
decides.

---

## How it is put together

```
backend/
  app/
    core/          configuration, database, redis, security, crypto, cache, otp, pagination
    models/        SQLAlchemy tables
    modules/       one folder per feature: router.py, service.py, schemas.py
    middleware/    rate limiting, request context, RBAC, clinic scoping, audit
    websockets/    live updates: auth, event contract, Redis fan-out
    documents/     HTML -> PDF for prescriptions, receipts, lab reports
    data/          roles and real clinical reference data
    workers/       Celery app and reminder schedule
  alembic/         database migrations
  scripts/seed.py  demo clinic
  tests/           pytest suite

frontend/src/
  api/             one file per resource, React Query hooks
  components/      ui/ (primitives), layout/, shared/, ai/
  pages/           one folder per panel
  lib/             utils, constants, validation schemas, realtime event map
  hooks/           websockets, debounce
```

**Two contracts worth knowing about:**

- **Naming** — the frontend speaks camelCase, the backend speaks snake_case.
  `src/lib/case.ts` translates in the API client, in one place, both ways.
- **Realtime** — `backend/app/websockets/events.py` names the events;
  `frontend/src/lib/realtime.ts` maps each one to the React Query keys it makes
  stale. Add an event to both files and every screen updates itself.

---

## Production notes

**Secrets.** `SECRET_KEY`, `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY` and
`ENCRYPTION_KEY` must each be set to unique random values. With
`ENVIRONMENT=production` the app **refuses to start** while the placeholders
are still in place — that is deliberate.

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"                       # secrets
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"   # ENCRYPTION_KEY
```

**Security as built:**

- Refresh tokens live in an httpOnly cookie, rotated on every use; JavaScript never touches them
- Access tokens are short-lived and refreshed automatically by the API client
- WebSockets are authenticated with the same JWT, and a user can only watch their own clinic
- OTPs are random, stored hashed with a TTL, attempt-limited, and consumed on use
- Aadhaar numbers and API keys are encrypted at rest and only ever displayed masked
- 102 permission checks across the API, driven by roles in `app/data/roles.py`
- Rate limits: per-IP globally, tighter on login, OTP and AI endpoints
- The waiting-room screen has its own public endpoint that carries no patient data

**Load handling:** a concurrency cap sheds traffic with 503 + `Retry-After`
before the database pool is exhausted; hot dashboard queries are cached in
Redis; list endpoints paginate; every request gets an `X-Request-ID` that
appears in the JSON logs, and slow requests are logged with their duration.

**Health probes:** `/api/v1/health` for liveness (no I/O),
`/api/v1/ready` for readiness (checks Postgres and Redis, returns 503 when
either is down).

---

## Tests

```bash
cd backend && python -m pytest        # 45 tests
cd frontend && npm run build          # type-check + production build
```

CI runs both on every push, applies the migrations against a real Postgres,
seeds it, and smoke-tests sign-in end to end.

---

## API documentation

With the backend running in development, the interactive docs are at
**http://localhost:8000/docs**. They are disabled automatically in production.
