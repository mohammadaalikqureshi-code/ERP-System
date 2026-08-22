"""Patient self-service portal.

Patients sign in with their mobile number and a one-time code — no password to
forget, and nothing for a clinic to reset. The code itself is handled by
`app.core.otp`; this module only decides who receives it and what a signed-in
patient is allowed to see.
"""

import logging
from datetime import date
from typing import Optional

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError, UnauthorizedError
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.emr import Prescription
from app.models.lab import LabOrder
from app.models.patient import Patient
from app.models.user import Role, User
from app.modules.api_keys.service import ApiKeyService
from app.modules.auth.service import AuthService
from app.modules.notifications.providers import get_provider
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Statuses that mean "this visit has not happened yet".
UPCOMING_STATUSES = ("booked", "checked_in", "in_consultation")


class PatientPortalService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _find_patient(self, mobile: str) -> Optional[Patient]:
        """Look up by the last 10 digits, so +91 prefixes do not matter."""
        statement = select(Patient).where(
            Patient.mobile.endswith(mobile[-10:]),
            Patient.is_deleted == False,  # noqa: E712
        )
        return (await self.db.execute(statement)).scalars().first()

    async def deliver_otp(self, mobile: str, code: str) -> None:
        """Send a login code, if that number belongs to a patient.

        Deliberately silent when the number is unknown: telling a caller
        "no such patient" would let anyone test whether someone is treated here.
        """
        patient = await self._find_patient(mobile)
        if not patient:
            logger.info("OTP requested for an unknown number", extra={"mobile_suffix": mobile[-4:]})
            return

        message = (
            f"{code} is your verification code for your patient portal login. "
            "It is valid for 5 minutes. Do not share it with anyone."
        )

        api_key = await ApiKeyService(self.db).resolve("whatsapp", patient.clinic_id)
        provider = get_provider("whatsapp", api_key)
        if not await provider.send_message(patient.mobile, message):
            sms_key = await ApiKeyService(self.db).resolve("msg91", patient.clinic_id)
            await get_provider("sms", sms_key).send_message(patient.mobile, message)

    async def sign_in(self, mobile: str, redis: Redis) -> dict:
        """Issue tokens for a patient whose code has already been verified."""
        patient = await self._find_patient(mobile)
        if not patient:
            raise UnauthorizedError("We could not find a patient with that mobile number.")

        user = (
            await self.db.execute(
                select(User)
                .options(selectinload(User.role))
                .where(User.phone == patient.mobile, User.is_deleted == False)  # noqa: E712
            )
        ).scalars().first()

        if not user:
            user = await self._create_portal_user(patient)

        return await AuthService(self.db, redis).generate_tokens(user)

    async def _create_portal_user(self, patient: Patient) -> User:
        """Create the login account for a patient on their first sign-in.

        The account has no usable password — the hash is a value bcrypt can
        never produce, so password sign-in can never succeed for it.
        """
        role = (
            await self.db.execute(select(Role).where(Role.name == "patient"))
        ).scalar_one_or_none()
        if not role:
            raise NotFoundError("The patient role is not configured on this system.")

        user = User(
            clinic_id=patient.clinic_id,
            role_id=role.id,
            full_name=patient.full_name,
            phone=patient.mobile,
            email=patient.email,
            password_hash="!",
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user, ["role"])
        return user

    async def get_dashboard(self, user: User) -> dict:
        """Everything the portal home screen shows."""
        patient = await self._find_patient(user.phone)
        if not patient:
            raise NotFoundError("We could not find your patient record.")

        appointments = list(
            (
                await self.db.execute(
                    select(Appointment)
                    .options(selectinload(Appointment.doctor).selectinload(Doctor.user))
                    .where(
                        Appointment.patient_id == patient.id,
                        Appointment.status.in_(UPCOMING_STATUSES),
                    )
                    .order_by(Appointment.appointment_date, Appointment.appointment_time)
                    .limit(5)
                )
            )
            .scalars()
            .all()
        )

        prescriptions = list(
            (
                await self.db.execute(
                    select(Prescription)
                    .options(selectinload(Prescription.items))
                    .where(Prescription.patient_id == patient.id)
                    .order_by(Prescription.created_at.desc())
                    .limit(5)
                )
            )
            .scalars()
            .all()
        )

        lab_orders = list(
            (
                await self.db.execute(
                    select(LabOrder)
                    .where(LabOrder.patient_id == patient.id)
                    .order_by(LabOrder.created_at.desc())
                    .limit(5)
                )
            )
            .scalars()
            .all()
        )

        return {
            "patient_id": patient.id,
            "patient_code": patient.patient_code,
            "full_name": patient.full_name,
            "mobile": patient.mobile,
            "upcoming_appointments": [
                {
                    "id": str(appointment.id),
                    "date": str(appointment.appointment_date),
                    "time": str(appointment.appointment_time),
                    "status": appointment.status,
                    "token_number": appointment.token_number,
                    "department": appointment.department,
                    "doctor_name": (
                        appointment.doctor.user.full_name
                        if appointment.doctor and appointment.doctor.user
                        else None
                    ),
                }
                for appointment in appointments
            ],
            "recent_prescriptions": [
                {
                    "id": str(prescription.id),
                    "date": str(prescription.created_at),
                    "notes": prescription.notes,
                    "medicine_count": len(prescription.items),
                }
                for prescription in prescriptions
            ],
            "lab_orders": [
                {
                    "id": str(order.id),
                    "status": order.status,
                    "date": str(order.created_at),
                }
                for order in lab_orders
            ],
        }

    async def get_queue_position(self, user: User) -> dict:
        """Where the patient is in today's queue, and the likely wait."""
        patient = await self._find_patient(user.phone)
        if not patient:
            raise NotFoundError("We could not find your patient record.")

        today = date.today()
        mine = (
            await self.db.execute(
                select(Appointment).where(
                    Appointment.patient_id == patient.id,
                    Appointment.appointment_date == today,
                    Appointment.status.in_(UPCOMING_STATUSES),
                )
            )
        ).scalars().first()

        if not mine:
            return {"in_queue": False, "message": "You have no appointment scheduled for today."}

        ahead = list(
            (
                await self.db.execute(
                    select(Appointment).where(
                        Appointment.doctor_id == mine.doctor_id,
                        Appointment.appointment_date == today,
                        Appointment.queue_number < mine.queue_number,
                        Appointment.status.in_(("booked", "checked_in")),
                    )
                )
            )
            .scalars()
            .all()
        )

        doctor = (
            await self.db.execute(select(Doctor).where(Doctor.id == mine.doctor_id))
        ).scalar_one_or_none()
        minutes_each = doctor.avg_consultation_minutes if doctor else 15

        return {
            "in_queue": True,
            "token_number": mine.token_number,
            "queue_number": mine.queue_number,
            "people_ahead": len(ahead),
            "estimated_wait_minutes": len(ahead) * minutes_each,
            "status": mine.status,
        }
