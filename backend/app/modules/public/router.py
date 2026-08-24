"""Endpoints that do not require a login.

1. Waiting-room live queue display.
2. Public Clinic Self-Service Onboarding & SaaS Subscription setup.
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, EmailStr
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.core.redis import get_redis
from app.core.security import get_password_hash
from app.middleware.rate_limit import rate_limiter
from app.models.appointment import Appointment
from app.models.clinic import Clinic, ClinicSettings
from app.models.doctor import Doctor
from app.models.user import Role, User
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/public", tags=["Public"])

# Statuses that put a patient on the board.
IN_QUEUE = ("booked", "checked_in")


# --- Waiting Room Display ---

@router.get("/queue", dependencies=[Depends(rate_limiter(limit=60, scope="public-queue"))])
async def public_queue(
    clinic_id: Optional[uuid.UUID] = Query(None),
    clinicId: Optional[uuid.UUID] = Query(None),
    doctor_id: Optional[uuid.UUID] = Query(None),
    doctorId: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """The token board for a waiting room."""
    clinic_id = clinic_id or clinicId
    doctor_id = doctor_id or doctorId
    if not clinic_id:
        raise ValidationError("A clinic id is required, e.g. ?clinicId=<uuid>")

    clinic = (
        await db.execute(
            select(Clinic).where(Clinic.id == clinic_id, Clinic.is_active == True)
        )
    ).scalar_one_or_none()
    if not clinic:
        raise NotFoundError("Clinic not found")

    statement = (
        select(Appointment)
        .options(selectinload(Appointment.doctor).selectinload(Doctor.user))
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == date.today(),
        )
        .order_by(Appointment.queue_number)
    )
    if doctor_id:
        statement = statement.where(Appointment.doctor_id == doctor_id)

    appointments = list((await db.execute(statement)).scalars().all())

    def doctor_name(appointment: Appointment) -> Optional[str]:
        if appointment.doctor and appointment.doctor.user:
            return appointment.doctor.user.full_name
        return None

    current = next((a for a in appointments if a.status == "in_consultation"), None)
    waiting = [a for a in appointments if a.status in IN_QUEUE]

    return {
        "clinic_name": clinic.name,
        "current": (
            {
                "token_number": current.token_number,
                "doctor_name": doctor_name(current),
                "department": current.department,
            }
            if current
            else None
        ),
        "waiting": [{"token_number": a.token_number} for a in waiting[:10]],
        "waiting_count": len(waiting),
        "completed_count": sum(1 for a in appointments if a.status == "completed"),
    }


# --- Public Self-Service Clinic Onboarding & SaaS Registration ---

class ClinicRegisterRequest(BaseModel):
    clinic_name: str
    address: str
    phone: str
    email: EmailStr
    gst_number: Optional[str] = None
    tagline: Optional[str] = None
    admin_name: str
    admin_email: EmailStr
    admin_password: str
    admin_phone: str
    plan_tier: Optional[str] = "professional"  # starter, professional, enterprise


@router.post("/register-clinic", dependencies=[Depends(rate_limiter(limit=10, scope="clinic-reg"))])
async def register_clinic(
    payload: ClinicRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Public self-service hospital/clinic onboarding with SaaS trial provisioning."""
    # 1. Check if email or phone is already taken
    existing_user = (await db.execute(
        select(User).where((User.email == payload.admin_email) | (User.phone == payload.admin_phone))
    )).scalar_one_or_none()
    if existing_user:
        raise ValidationError("An account with this administrator email or phone already exists.")

    # 2. Find clinic_admin role
    admin_role = (await db.execute(
        select(Role).where(Role.name == "clinic_admin")
    )).scalar_one_or_none()
    if not admin_role:
        raise NotFoundError("System default role 'clinic_admin' not configured.")

    # 3. Create Clinic
    clinic = Clinic(
        name=payload.clinic_name,
        address=payload.address,
        phone=payload.phone,
        email=payload.email,
        gst_number=payload.gst_number,
        tagline=payload.tagline or "Quality Healthcare Services",
        primary_color="#0d9488",
        is_active=True,
    )
    db.add(clinic)
    await db.flush()

    # 4. Create ClinicSettings with default GST
    clinic_settings = ClinicSettings(
        clinic_id=clinic.id,
        gst_rate=18.0,
        cgst_rate=9.0,
        sgst_rate=9.0,
        tts_enabled=True,
        tts_language="en-IN",
        auto_sms_appointment=True,
        auto_sms_prescription=True,
        auto_sms_lab_report=True,
    )
    db.add(clinic_settings)

    # 5. Create Administrator User
    admin_user = User(
        clinic_id=clinic.id,
        role_id=admin_role.id,
        full_name=payload.admin_name,
        email=payload.admin_email,
        phone=payload.admin_phone,
        password_hash=get_password_hash(payload.admin_password),
        is_active=True,
    )
    db.add(admin_user)
    await db.commit()

    # 6. Reload user with role for token generation
    stmt = select(User).options(selectinload(User.role)).where(User.id == admin_user.id)
    reloaded_user = (await db.execute(stmt)).scalar_one()

    # 7. Generate JWT access and refresh tokens
    auth_service = AuthService(db, redis)
    tokens = await auth_service.generate_tokens(reloaded_user)

    # Set httpOnly cookie for refresh token
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=tokens["refresh_token"],
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN or None,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )

    return {
        "message": "Clinic and administrator account successfully provisioned.",
        "clinic": {
            "id": str(clinic.id),
            "name": clinic.name,
            "email": clinic.email,
            "plan_tier": payload.plan_tier,
            "trial_days": 14,
        },
        "accessToken": tokens["access_token"],
        "tokenType": "bearer",
        "profile": tokens["profile"],
    }
