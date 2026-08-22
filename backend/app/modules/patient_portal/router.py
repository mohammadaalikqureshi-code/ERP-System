from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.exceptions import ValidationError
from app.core.otp import OtpError, issue, verify
from app.core.redis import get_redis
from app.middleware.rate_limit import rate_limiter
from app.middleware.rbac import require_permission
from app.models.user import User
from app.modules.patient_portal.schemas import (
    PatientDashboardInfo,
    PatientLoginRequest,
    PatientLoginVerify,
    PatientOtpResponse,
    PatientTokenResponse,
)
from app.modules.patient_portal.service import PatientPortalService

router = APIRouter(prefix="/patient-portal", tags=["Patient Portal"])


@router.post(
    "/login/request",
    response_model=PatientOtpResponse,
    dependencies=[
        Depends(rate_limiter(limit=settings.RATE_LIMIT_OTP_PER_HOUR, window=3600, scope="portal-otp"))
    ],
)
async def request_otp(payload: PatientLoginRequest, db: AsyncSession = Depends(get_db)):
    """Send a one-time login code to the patient's mobile."""
    challenge, code = await issue(payload.mobile)
    await PatientPortalService(db).deliver_otp(payload.mobile, code)
    return PatientOtpResponse(
        sent=True,
        expires_in=challenge.expires_in,
        debug_code=challenge.debug_code,
        message="If that number is registered with us, a code has been sent to it.",
    )


@router.post("/login/verify", response_model=PatientTokenResponse)
async def verify_otp(
    payload: PatientLoginVerify,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Check the code and sign the patient in."""
    try:
        await verify(payload.mobile, payload.otp)
    except OtpError as exc:
        raise ValidationError(str(exc))

    return await PatientPortalService(db).sign_in(payload.mobile, redis)


@router.get(
    "/dashboard",
    response_model=PatientDashboardInfo,
    dependencies=[Depends(require_permission("patient_portal.read"))],
)
async def get_dashboard(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    return await PatientPortalService(db).get_dashboard(current_user)


@router.get("/queue", dependencies=[Depends(require_permission("patient_portal.read"))])
async def get_queue_position(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    """The patient's live position in today's queue."""
    return await PatientPortalService(db).get_queue_position(current_user)
