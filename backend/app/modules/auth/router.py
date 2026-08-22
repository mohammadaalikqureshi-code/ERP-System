"""Authentication endpoints.

Two ways in:
  * staff sign in with email/phone + password
  * patients sign in with their mobile number and a one-time code

The access token is returned in the response body (the SPA keeps it in memory
and in storage), while the refresh token is set as an httpOnly cookie so
JavaScript — and therefore any XSS on the page — cannot read it.
"""

import logging

from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.exceptions import UnauthorizedError, ValidationError
from app.core.otp import OtpError, issue, verify
from app.core.redis import get_redis
from app.middleware.rate_limit import rate_limiter
from app.models.user import User
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    OTPRequest,
    OTPResponse,
    OTPVerify,
    TokenResponse,
    UserProfile,
)
from app.modules.auth.service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN or None,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN or None,
        path="/",
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    dependencies=[Depends(rate_limiter(limit=settings.RATE_LIMIT_LOGIN_PER_MINUTE, scope="login"))],
)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Staff sign-in with email or phone plus password."""
    service = AuthService(db, redis)
    user = await service.authenticate(payload.email_or_phone, payload.password)
    tokens = await service.generate_tokens(user)

    _set_refresh_cookie(response, tokens["refresh_token"])
    logger.info("User signed in", extra={"user_id": str(user.id)})

    # The refresh token stays in the cookie only.
    return {k: v for k, v in tokens.items() if k != "refresh_token"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Exchange the refresh cookie for a new access token.

    The refresh token is rotated on every use, so a stolen one is only good
    until the real user's browser next refreshes.
    """
    token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not token:
        raise UnauthorizedError("Your session has expired. Please sign in again.")

    tokens = await AuthService(db, redis).refresh_token(token)
    _set_refresh_cookie(response, tokens["refresh_token"])
    return {k: v for k, v in tokens.items() if k != "refresh_token"}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Sign out and revoke the refresh token family."""
    token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if token:
        await AuthService(db, redis).logout(token)
    _clear_refresh_cookie(response)
    return {"status": "success"}


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return UserProfile(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        phone=current_user.phone,
        role=current_user.role.name,
        role_name=current_user.role.name,
        permissions=current_user.role.permissions,
        clinic_id=current_user.clinic_id,
    )


@router.post(
    "/otp/request",
    response_model=OTPResponse,
    dependencies=[
        Depends(rate_limiter(limit=settings.RATE_LIMIT_OTP_PER_HOUR, window=3600, scope="otp"))
    ],
)
async def request_otp(payload: OTPRequest, db: AsyncSession = Depends(get_db)):
    """Send a one-time code to a mobile number.

    The same response is returned whether or not the number is registered, so
    this endpoint cannot be used to discover who is a patient here.
    """
    from app.modules.patient_portal.service import PatientPortalService

    challenge, code = await issue(payload.phone)
    await PatientPortalService(db).deliver_otp(payload.phone, code)

    return OTPResponse(
        sent=True,
        expires_in=challenge.expires_in,
        debug_code=challenge.debug_code,
        message="If that number is registered, a code has been sent to it.",
    )


@router.post("/otp/verify", response_model=LoginResponse)
async def verify_otp(
    payload: OTPVerify,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Verify a code and sign the patient in."""
    from app.modules.patient_portal.service import PatientPortalService

    try:
        await verify(payload.phone, payload.otp)
    except OtpError as exc:
        raise ValidationError(str(exc))

    tokens = await PatientPortalService(db).sign_in(payload.phone, redis)
    _set_refresh_cookie(response, tokens["refresh_token"])
    return {k: v for k, v in tokens.items() if k != "refresh_token"}
