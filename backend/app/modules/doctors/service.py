from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, cast
from app.models.doctor import Doctor, DoctorSchedule, DoctorLeave
from app.models.clinic import Holiday
from app.models.appointment import Appointment
from app.modules.doctors.schemas import DoctorCreate, DoctorUpdate, ScheduleCreate, LeaveCreate
from app.core.exceptions import NotFoundError
import uuid
from datetime import date, datetime, timedelta, time

class DoctorService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_doctor(self, clinic_id: uuid.UUID, data: DoctorCreate):
        doctor = Doctor(clinic_id=clinic_id, **data.model_dump())
        self.db.add(doctor)
        await self.db.commit()
        await self.db.refresh(doctor)
        return doctor

    async def _resolve_doctor_id(self, doctor_or_user_id: uuid.UUID) -> uuid.UUID:
        stmt = select(Doctor.id).where(
            (Doctor.id == doctor_or_user_id) | (Doctor.user_id == doctor_or_user_id)
        )
        real_id = (await self.db.execute(stmt)).scalar_one_or_none()
        return real_id if real_id else doctor_or_user_id

    async def get_doctor(self, clinic_id: uuid.UUID, doctor_id: uuid.UUID):
        stmt = select(Doctor).where(
            ((Doctor.id == doctor_id) | (Doctor.user_id == doctor_id)),
            Doctor.clinic_id == clinic_id,
            Doctor.is_deleted == False
        )
        result = await self.db.execute(stmt)
        doctor = result.scalar_one_or_none()
        if not doctor:
            raise NotFoundError("Doctor not found")
        return doctor

    async def list_doctors(self, clinic_id: uuid.UUID):
        from sqlalchemy.orm import selectinload
        stmt = select(Doctor).options(selectinload(Doctor.user)).where(Doctor.clinic_id == clinic_id, Doctor.is_deleted == False)
        result = await self.db.execute(stmt)
        docs = result.scalars().all()
        response = []
        for d in docs:
            response.append({
                "id": str(d.id),
                "clinic_id": str(d.clinic_id),
                "user_id": str(d.user_id),
                "specialization": d.specialization,
                "department": d.department,
                "qualification": d.qualification,
                "consultation_fee": d.consultation_fee,
                "avg_consultation_minutes": d.avg_consultation_minutes,
                "signature_url": d.signature_url,
                "is_available": d.is_available,
                "isActive": d.is_available,
                "firstName": d.user.full_name if d.user else "Doctor",
                "lastName": ""
            })
        return response

    async def update_doctor(self, clinic_id: uuid.UUID, doctor_id: uuid.UUID, data: DoctorUpdate):
        doctor = await self.get_doctor(clinic_id, doctor_id)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(doctor, k, v)
        await self.db.commit()
        await self.db.refresh(doctor)
        return doctor

    async def add_schedule(self, doctor_id: uuid.UUID, data: ScheduleCreate):
        real_id = await self._resolve_doctor_id(doctor_id)
        schedule = DoctorSchedule(doctor_id=real_id, **data.model_dump())
        self.db.add(schedule)
        await self.db.commit()
        await self.db.refresh(schedule)
        return schedule

    async def get_schedules(self, doctor_id: uuid.UUID):
        real_id = await self._resolve_doctor_id(doctor_id)
        stmt = select(DoctorSchedule).where(DoctorSchedule.doctor_id == real_id)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def add_leave(self, doctor_id: uuid.UUID, data: LeaveCreate):
        real_id = await self._resolve_doctor_id(doctor_id)
        leave = DoctorLeave(doctor_id=real_id, **data.model_dump())
        self.db.add(leave)
        await self.db.commit()
        await self.db.refresh(leave)
        return leave

    async def get_leaves(self, doctor_id: uuid.UUID):
        real_id = await self._resolve_doctor_id(doctor_id)
        stmt = select(DoctorLeave).where(DoctorLeave.doctor_id == real_id)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_available_slots(self, clinic_id: uuid.UUID, doctor_id: uuid.UUID, target_date: date):
        # 1. Holiday Check
        stmt = select(Holiday).where(Holiday.clinic_id == clinic_id, Holiday.date == target_date)
        if (await self.db.execute(stmt)).scalar_one_or_none():
            return []

        # 2. Leave Check
        stmt = select(DoctorLeave).where(
            DoctorLeave.doctor_id == doctor_id,
            DoctorLeave.is_approved == True,
            DoctorLeave.date_from <= target_date,
            DoctorLeave.date_to >= target_date
        )
        if (await self.db.execute(stmt)).scalar_one_or_none():
            return []

        # 3. Schedule Check
        day_of_week = target_date.weekday()
        stmt = select(DoctorSchedule).where(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.day_of_week == day_of_week
        )
        schedule = (await self.db.execute(stmt)).scalar_one_or_none()
        if not schedule:
            return []

        # 4. Existing Appointments
        stmt = select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == target_date,
            Appointment.status.notin_(["cancelled", "no_show"])
        )
        existing_appointments = (await self.db.execute(stmt)).scalars().all()
        booked_times = {app.appointment_time for app in existing_appointments}

        # 5. Generate Slots
        slots = []
        dt_start = datetime.combine(target_date, schedule.start_time)
        dt_end = datetime.combine(target_date, schedule.end_time)
        dt_current = dt_start

        while dt_current + timedelta(minutes=schedule.slot_duration_minutes) <= dt_end:
            slot_start = dt_current.time()
            slot_end = (dt_current + timedelta(minutes=schedule.slot_duration_minutes)).time()
            
            # Check break time
            is_break = False
            if schedule.break_start and schedule.break_end:
                if schedule.break_start <= slot_start < schedule.break_end:
                    is_break = True
            
            # Booked slots are returned marked unavailable rather than hidden:
            # a receptionist needs to see the day filling up, and a slot that
            # silently disappears looks like a bug to them.
            if not is_break:
                slots.append(
                    {
                        "time": slot_start.strftime("%H:%M"),
                        "start_time": slot_start,
                        "end_time": slot_end,
                        "is_available": slot_start not in booked_times,
                    }
                )

            dt_current += timedelta(minutes=schedule.slot_duration_minutes)

        return slots
