"""MediCare ERP — application entrypoint.

Middleware order matters and is deliberate (outermost first):

    1. RequestContext   tag the request, time it, catch anything unhandled
    2. ConcurrencyLimit shed load before it reaches the database pool
    3. RateLimit        stop one caller monopolising the API
    4. CORS             browser access control

so that a request rejected by the limiter is still logged with an id, and a
rejection never consumes a database connection.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import check_database, engine
from app.core.exceptions import BaseAPIException, api_exception_handler
from app.core.logging import configure_logging
from app.core.redis import check_redis, redis_pool
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_context import ConcurrencyLimitMiddleware, RequestContextMiddleware
from app.websockets.auth import WS_FORBIDDEN, WS_UNAUTHORIZED, authenticate_socket, may_watch_clinic
from app.websockets.events import public_room_for_clinic, room_for_clinic
from app.websockets.queue_manager import manager

# Routers
from app.modules.ai.router import router as ai_router
from app.modules.api_keys.router import router as api_keys_router
from app.modules.appointments.router import router as appointments_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.branches.router import router as branches_router
from app.modules.clinics.router import router as clinics_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.doctors.router import router as doctors_router
from app.modules.emr.router import router as emr_router
from app.modules.inventory.router import router as inventory_router
from app.modules.lab.router import router as lab_router
from app.modules.notifications.router import router as notifications_router
from app.modules.panels.router import router as panels_router
from app.modules.patient_portal.router import router as patient_portal_router
from app.modules.patients.router import router as patients_router
from app.modules.public.router import router as public_router
from app.modules.reports.router import router as reports_router
from app.modules.uploads.router import router as uploads_router
from app.modules.users.router import router as users_router
from app.modules.backup.router import router as backup_router

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Starting %s", settings.APP_NAME, extra={"environment": settings.ENVIRONMENT}
    )

    if not await check_database():
        # Log loudly but still start: an orchestrator's readiness probe should
        # decide whether to route traffic here, not an unexplained crash loop.
        logger.error("Database is not reachable at startup — /ready will report not-ready")
    else:
        # Run market-ready migration (idempotent — uses IF NOT EXISTS / IF NOT EXISTS)
        try:
            from app.migrations.market_ready import run_migration
            await run_migration()
            logger.info("Market-ready migration completed")
        except Exception:
            logger.warning("Market-ready migration skipped", exc_info=True)

    if not await check_redis():
        logger.info("Redis not connected — standalone single-instance mode active")

    yield

    logger.info("Shutting down")
    await manager.shutdown()
    await engine.dispose()
    await redis_pool.disconnect()


app = FastAPI(
    title=f"{settings.APP_NAME} API",
    description="Hospital and multi-specialty clinic ERP.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

# --- middleware (outermost first) -------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time-ms"],
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(ConcurrencyLimitMiddleware)
app.add_middleware(RequestContextMiddleware)

app.add_exception_handler(BaseAPIException, api_exception_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    """Never leak a stack trace to a client."""
    logger.exception("Unhandled exception", extra={"path": request.url.path})
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "Something went wrong on our side. The team has been notified.",
                "details": [],
            }
        },
    )


# --- uploaded files ---------------------------------------------------------
uploads_dir = os.path.abspath(settings.UPLOAD_DIR)
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# --- API routes -------------------------------------------------------------
for router in (
    auth_router,
    clinics_router,
    branches_router,
    users_router,
    patients_router,
    doctors_router,
    appointments_router,
    emr_router,
    lab_router,
    inventory_router,
    billing_router,
    reports_router,
    dashboard_router,
    audit_router,
    notifications_router,
    patient_portal_router,
    uploads_router,
    api_keys_router,
    ai_router,
    panels_router,
    public_router,
    backup_router,
):
    app.include_router(router, prefix=settings.API_V1_STR)


# --- health probes ----------------------------------------------------------
@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
async def health_check():
    """Liveness: is the process up? Deliberately does no I/O."""
    return {"status": "ok", "environment": settings.ENVIRONMENT, "version": app.version}


@app.get(f"{settings.API_V1_STR}/ready", tags=["Health"])
async def readiness_check():
    """Readiness: can this instance actually serve traffic?

    Checks its dependencies, and returns 503 when one is down so a load
    balancer stops sending requests here instead of failing them.
    """
    database_ok = await check_database()
    redis_ok = await check_redis()
    ready = database_ok and redis_ok

    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
            "checks": {"database": database_ok, "redis": redis_ok},
        },
    )


# --- realtime ---------------------------------------------------------------
@app.websocket(f"{settings.API_V1_STR}/ws/queue")
async def websocket_queue(
    websocket: WebSocket,
    token: str = Query(None),
    clinic_id: str = Query(None, alias="clinic_id"),
):
    """Live updates for signed-in staff.

    The access token is passed as a query parameter because browsers cannot set
    headers on a WebSocket. It is verified exactly like a REST request, and a
    user may only watch their own clinic.
    """
    identity = await authenticate_socket(token)
    if not identity:
        await websocket.close(code=WS_UNAUTHORIZED, reason="Authentication required")
        return

    if not may_watch_clinic(identity, clinic_id):
        await websocket.close(code=WS_FORBIDDEN, reason="Not permitted for this clinic")
        return

    room = room_for_clinic(clinic_id or identity.clinic_id)
    await manager.connect(room, websocket)
    logger.info("WebSocket connected", extra={"room": room, "user_id": str(identity.user_id)})

    try:
        while True:
            # The client sends nothing meaningful; this keeps the socket open
            # and gives us a clean disconnect when the browser goes away.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.info("WebSocket closed unexpectedly", exc_info=True)
    finally:
        await manager.disconnect(room, websocket)


@app.websocket(f"{settings.API_V1_STR}/ws/queue/public")
async def websocket_public_queue(websocket: WebSocket, clinic_id: str = Query(None, alias="clinic_id")):
    """Live updates for the waiting-room display.

    Unauthenticated by necessity — a TV has nobody to sign in. Only refresh
    signals are sent to this room, never patient data.
    """
    if not clinic_id:
        await websocket.close(code=WS_FORBIDDEN, reason="clinic_id is required")
        return

    room = public_room_for_clinic(clinic_id)
    await manager.connect(room, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.info("Public WebSocket closed unexpectedly", exc_info=True)
    finally:
        await manager.disconnect(room, websocket)


# --- serve the built frontend, if it is present -----------------------------
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))

if os.path.isdir(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        """Serve the single-page app, letting the router handle unknown paths."""
        if full_path.startswith(("api/", "static/")):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

        candidate = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)

        return FileResponse(os.path.join(frontend_dist, "index.html"))
