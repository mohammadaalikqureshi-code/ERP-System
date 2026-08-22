"""Endpoints that do not require a login.

Only the waiting-room display lives here. It runs on a TV that nobody signs in
to, so it must be reachable anonymously — which means it must never expose a
patient's identity. These responses contain token numbers and the doctor's
name, and nothing else.
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.middleware.rate_limit import rate_limiter
from app.models.appointment import Appointment
from app.models.clinic import Clinic
from app.models.doctor import Doctor

router = APIRouter(prefix="/public", tags=["Public"])

# Statuses that put a patient on the board.
IN_QUEUE = ("booked", "checked_in")


@router.get("/queue", dependencies=[Depends(rate_limiter(limit=60, scope="public-queue"))])
async def public_queue(
    # Accept both spellings: the app sends snake_case, while a URL typed by
    # hand on the waiting-room TV usually carries the camelCase form.
    clinic_id: Optional[uuid.UUID] = Query(None),
    clinicId: Optional[uuid.UUID] = Query(None),  # noqa: N803
    doctor_id: Optional[uuid.UUID] = Query(None),
    doctorId: Optional[uuid.UUID] = Query(None),  # noqa: N803
    db: AsyncSession = Depends(get_db),
):
    """The token board for a waiting room.

    No patient names, no mobile numbers, no diagnoses — only what a stranger in
    the waiting room may already see on the wall.
    """
    clinic_id = clinic_id or clinicId
    doctor_id = doctor_id or doctorId
    if not clinic_id:
        raise ValidationError("A clinic id is required, e.g. ?clinicId=<uuid>")

    clinic = (
        await db.execute(
            select(Clinic).where(Clinic.id == clinic_id, Clinic.is_active == True)  # noqa: E712
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
