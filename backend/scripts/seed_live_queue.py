import asyncio
from datetime import date, time, datetime
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment

async def seed_queue():
    async with AsyncSessionLocal() as session:
        clinic = (await session.execute(select(Clinic).limit(1))).scalar_one_or_none()
        doctor = (await session.execute(select(Doctor).limit(1))).scalar_one_or_none()
        admin = (await session.execute(select(User).limit(1))).scalar_one_or_none()

        patients = (await session.execute(select(Patient).limit(5))).scalars().all()
        if not patients:
            print("No patients found.")
            return

        # 1. Active In-Consultation Appointment (NOW SERVING)
        current_appt = (await session.execute(select(Appointment).where(Appointment.appointment_date == date.today(), Appointment.status == "in_consultation"))).scalar_one_or_none()
        if not current_appt:
            current_appt = Appointment(
                clinic_id=clinic.id,
                patient_id=patients[0].id,
                doctor_id=doctor.id,
                department=doctor.department or "Cardiology",
                visit_type="follow_up",
                appointment_date=date.today(),
                appointment_time=time(17, 30),
                token_number="A-101",
                queue_number=1,
                status="in_consultation",
                booked_by=admin.id,
                checked_in_at=datetime.now(),
                consultation_started_at=datetime.now()
            )
            session.add(current_appt)

        # 2. Upcoming checked-in waiting tokens
        queue_tokens = [
            ("A-102", "Pediatrics", 2),
            ("A-103", "Orthopedics", 3),
            ("A-104", "General Medicine", 4),
            ("A-105", "Dermatology", 5),
        ]

        for i, (tok, dept, q_num) in enumerate(queue_tokens):
            p_idx = (i + 1) % len(patients)
            existing = (await session.execute(select(Appointment).where(Appointment.appointment_date == date.today(), Appointment.token_number == tok))).scalar_one_or_none()
            if not existing:
                appt = Appointment(
                    clinic_id=clinic.id,
                    patient_id=patients[p_idx].id,
                    doctor_id=doctor.id,
                    department=dept,
                    visit_type="new",
                    appointment_date=date.today(),
                    appointment_time=time(17, 45),
                    token_number=tok,
                    queue_number=q_num,
                    status="checked_in",
                    booked_by=admin.id,
                    checked_in_at=datetime.now()
                )
                session.add(appt)

        await session.commit()
        print("✅ Live OPD Queue Active: A-101 (Now Serving) + A-102, A-103, A-104 (Waiting)")

if __name__ == "__main__":
    asyncio.run(seed_queue())
