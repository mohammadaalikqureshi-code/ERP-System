"""Dashboard figures.

Every number here is computed from the database. The results are cached in
Redis for a short window because a whole clinic loads the same dashboard on
every screen, and none of these figures need to be accurate to the second.
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import cached
from app.models.appointment import Appointment
from app.models.billing import Bill
from app.models.doctor import Doctor
from app.models.inventory import InventoryItem
from app.models.lab import LabOrder
from app.models.patient import Patient

# Statuses that mean the patient has not been seen yet.
PENDING_STATUSES = ("booked", "checked_in")


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _today() -> datetime.date:
        return datetime.now(timezone.utc).date()

    async def _status_counts(self, clinic_id: uuid.UUID, day, doctor_id: uuid.UUID | None = None) -> dict:
        statement = (
            select(Appointment.status, func.count(Appointment.id))
            .where(Appointment.clinic_id == clinic_id, Appointment.appointment_date == day)
            .group_by(Appointment.status)
        )
        if doctor_id:
            statement = statement.where(Appointment.doctor_id == doctor_id)

        return {row[0]: row[1] for row in (await self.db.execute(statement)).all()}

    async def _revenue_between(
        self, clinic_id: uuid.UUID, start: datetime, end: datetime, doctor_id: uuid.UUID | None = None
    ) -> Decimal:
        statement = select(func.coalesce(func.sum(Bill.total_amount), 0)).where(
            Bill.clinic_id == clinic_id,
            Bill.created_at >= start,
            Bill.created_at < end,
            Bill.payment_status == "paid",
        )
        if doctor_id:
            statement = statement.join(
                Appointment, Bill.appointment_id == Appointment.id
            ).where(Appointment.doctor_id == doctor_id)

        return Decimal(str((await self.db.execute(statement)).scalar() or 0))

    async def get_reception_dashboard(self, clinic_id: uuid.UUID) -> dict:
        async def build() -> dict:
            today = self._today()
            start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)

            patients_today = (
                await self.db.execute(
                    select(func.count(Patient.id)).where(
                        Patient.clinic_id == clinic_id, func.date(Patient.created_at) == today
                    )
                )
            ).scalar() or 0

            revenue = await self._revenue_between(clinic_id, start, start + timedelta(days=1))
            counts = await self._status_counts(clinic_id, today)

            recent = list(
                (
                    await self.db.execute(
                        select(Appointment)
                        .options(
                            selectinload(Appointment.patient),
                            selectinload(Appointment.doctor).selectinload(Doctor.user),
                        )
                        .where(
                            Appointment.clinic_id == clinic_id,
                            Appointment.appointment_date == today,
                        )
                        .order_by(Appointment.created_at.desc())
                        .limit(10)
                    )
                )
                .scalars()
                .all()
            )

            return {
                "totalPatients": patients_today,
                "revenue": float(revenue),
                "appointments": {
                    "booked": counts.get("booked", 0),
                    "checkedIn": counts.get("checked_in", 0),
                    "inConsultation": counts.get("in_consultation", 0),
                    "completed": counts.get("completed", 0),
                    "cancelled": counts.get("cancelled", 0),
                    "noShow": counts.get("no_show", 0),
                },
                "recentAppointments": [
                    {
                        "id": str(appointment.id),
                        "patient": {
                            "firstName": appointment.patient.full_name if appointment.patient else "Unknown",
                            "lastName": "",
                        },
                        "doctor": {
                            "firstName": (
                                appointment.doctor.user.full_name
                                if appointment.doctor and appointment.doctor.user
                                else "Unknown"
                            ),
                            "lastName": "",
                        },
                        "appointmentTime": appointment.appointment_time.strftime("%H:%M"),
                        "tokenNumber": appointment.token_number,
                        "status": appointment.status,
                    }
                    for appointment in recent
                ],
            }

        return await cached(f"dashboard:reception:{clinic_id}", loader=build, ttl=30)

    async def get_doctor_dashboard(self, clinic_id: uuid.UUID, doctor_id: uuid.UUID) -> dict:
        async def build() -> dict:
            today = self._today()
            start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)

            counts = await self._status_counts(clinic_id, today, doctor_id)
            completed = counts.get("completed", 0)
            pending = sum(counts.get(status, 0) for status in PENDING_STATUSES)

            # Real average consultation length: measured from the appointments
            # this doctor actually started and finished today.
            duration = (
                await self.db.execute(
                    select(
                        func.avg(
                            func.extract(
                                "epoch",
                                Appointment.completed_at - Appointment.consultation_started_at,
                            )
                        )
                    ).where(
                        Appointment.doctor_id == doctor_id,
                        Appointment.appointment_date == today,
                        Appointment.completed_at.isnot(None),
                        Appointment.consultation_started_at.isnot(None),
                    )
                )
            ).scalar()

            if duration:
                average_minutes = round(float(duration) / 60, 1)
            else:
                # Nothing measured yet today — fall back to the doctor's own
                # configured slot length rather than inventing a number.
                doctor = (
                    await self.db.execute(select(Doctor).where(Doctor.id == doctor_id))
                ).scalar_one_or_none()
                average_minutes = doctor.avg_consultation_minutes if doctor else 15

            earnings = await self._revenue_between(
                clinic_id, start, start + timedelta(days=1), doctor_id
            )

            follow_ups = (
                await self.db.execute(
                    select(func.count(Appointment.id)).where(
                        Appointment.doctor_id == doctor_id,
                        Appointment.visit_type == "follow_up",
                        Appointment.appointment_date > today,
                        Appointment.status.in_(PENDING_STATUSES),
                    )
                )
            ).scalar() or 0

            pending_labs = (
                await self.db.execute(
                    select(func.count(LabOrder.id)).where(
                        LabOrder.doctor_id == doctor_id, LabOrder.status != "completed"
                    )
                )
            ).scalar() or 0

            return {
                "todayAppointments": {
                    "booked": counts.get("booked", 0),
                    "checkedIn": counts.get("checked_in", 0),
                    "inConsultation": counts.get("in_consultation", 0),
                    "completed": completed,
                    "cancelled": counts.get("cancelled", 0),
                },
                "avgConsultationTime": average_minutes,
                "todayEarnings": float(earnings),
                "upcomingFollowUps": int(follow_ups),
                "pendingLabOrders": int(pending_labs),
                "totalPatients": sum(counts.values()),
                "completed": completed,
                "pending": pending,
            }

        return await cached(f"dashboard:doctor:{doctor_id}", loader=build, ttl=30)

    async def get_admin_dashboard(self, clinic_id: uuid.UUID) -> dict:
        async def build() -> dict:
            today = self._today()
            month_start = datetime.combine(today.replace(day=1), datetime.min.time()).replace(
                tzinfo=timezone.utc
            )

            revenue_month = await self._revenue_between(
                clinic_id, month_start, datetime.now(timezone.utc) + timedelta(days=1)
            )

            total_patients = (
                await self.db.execute(
                    select(func.count(Patient.id)).where(
                        Patient.clinic_id == clinic_id,
                        Patient.is_deleted == False,  # noqa: E712
                    )
                )
            ).scalar() or 0

            appointments_today = (
                await self.db.execute(
                    select(func.count(Appointment.id)).where(
                        Appointment.clinic_id == clinic_id, Appointment.appointment_date == today
                    )
                )
            ).scalar() or 0

            active_doctors = (
                await self.db.execute(
                    select(func.count(Doctor.id)).where(
                        Doctor.clinic_id == clinic_id,
                        Doctor.is_deleted == False,  # noqa: E712
                        Doctor.is_available == True,  # noqa: E712
                    )
                )
            ).scalar() or 0

            low_stock = (
                await self.db.execute(
                    select(func.count(InventoryItem.id)).where(
                        InventoryItem.clinic_id == clinic_id,
                        InventoryItem.is_deleted == False,  # noqa: E712
                        InventoryItem.stock_quantity <= InventoryItem.reorder_level,
                    )
                )
            ).scalar() or 0

            unpaid = (
                await self.db.execute(
                    select(func.count(Bill.id)).where(
                        Bill.clinic_id == clinic_id, Bill.payment_status != "paid"
                    )
                )
            ).scalar() or 0

            counts = await self._status_counts(clinic_id, today)
            booked_today = sum(counts.values())
            no_shows = counts.get("no_show", 0)

            return {
                "totalRevenue": float(revenue_month),
                "totalPatients": int(total_patients),
                "totalAppointments": int(appointments_today),
                "activeDoctors": int(active_doctors),
                "lowStockItems": int(low_stock),
                "unpaidBills": int(unpaid),
                "noShowRate": round(no_shows / booked_today * 100, 1) if booked_today else 0.0,
            }

        return await cached(f"dashboard:admin:{clinic_id}", loader=build, ttl=60)
