from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.modules.appointments.schemas import AppointmentCreate, AppointmentUpdate, StatusUpdate, RescheduleRequest
from app.modules.doctors.service import DoctorService
from app.core.exceptions import NotFoundError, ValidationError
from app.websockets.queue_manager import manager
from app.websockets.events import Events, build, public_room_for_clinic, room_for_clinic
from app.models.doctor import Doctor as DoctorModel
from sqlalchemy.exc import IntegrityError
import logging
import uuid
from datetime import datetime, timezone
from app.modules.notifications.tasks import send_notification_task

logger = logging.getLogger(__name__)

class AppointmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_queue_number(self, doctor_id: uuid.UUID, target_date: str) -> int:
        stmt = select(func.max(Appointment.queue_number)).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == target_date
        )
        max_q = (await self.db.execute(stmt)).scalar()
        return (max_q or 0) + 1

    async def create_appointment(self, clinic_id: uuid.UUID, user_id: uuid.UUID, data: AppointmentCreate):
        """Book an appointment and put the patient in the doctor's queue.

        Two receptionists can book the same doctor at the same instant, so the
        token number is allocated inside a retry loop: the database enforces
        uniqueness and we take the next free number if we lose the race.
        """
        doc_service = DoctorService(self.db)
        slots = await doc_service.get_available_slots(clinic_id, data.doctor_id, data.appointment_date)
        if not any(s["start_time"] == data.appointment_time for s in slots):
            raise ValidationError("That slot is no longer available. Please pick another time.")

        values = data.model_dump()
        if not values.get("department"):
            doctor = (
                await self.db.execute(select(DoctorModel).where(DoctorModel.id == data.doctor_id))
            ).scalar_one_or_none()
            values["department"] = doctor.department if doctor else "General Medicine"

        last_error = None
        for attempt in range(5):
            queue_num = await self._generate_queue_number(data.doctor_id, data.appointment_date)
            appointment = Appointment(
                clinic_id=clinic_id,
                booked_by=user_id,
                token_number=f"A-{queue_num:03d}",
                queue_number=queue_num,
                **values,
            )
            self.db.add(appointment)
            try:
                await self.db.commit()
                break
            except IntegrityError as exc:
                await self.db.rollback()
                last_error = exc
                logger.info("Token collision while booking, retrying", extra={"attempt": attempt + 1})
        else:
            raise ValidationError(
                "Could not allocate a token just now — too many bookings at once. Please try again."
            ) from last_error

        await self.db.refresh(appointment)

        send_notification_task.delay(
            str(appointment.patient_id),
            "booking_confirmation",
            {"date": str(data.appointment_date), "time": str(data.appointment_time), "doctor": "Dr."},
        )
        await self._announce(
            clinic_id,
            Events.APPOINTMENT_CREATED,
            appointment.id,
            token_number=appointment.token_number,
        )

        return appointment

    async def _announce(self, clinic_id, event_type: str, entity_id=None, **data):
        """Tell staff screens about a change, and nudge the waiting-room display.

        The public room only ever receives a "something changed" signal — it
        re-fetches the anonymised board itself.
        """
        await manager.broadcast(room_for_clinic(clinic_id), build(event_type, entity_id, **data))
        await manager.broadcast(public_room_for_clinic(clinic_id), build(Events.QUEUE_UPDATED))

    async def get_appointment(self, clinic_id: uuid.UUID, appointment_id: uuid.UUID):
        stmt = select(Appointment).where(Appointment.id == appointment_id, Appointment.clinic_id == clinic_id)
        result = await self.db.execute(stmt)
        app = result.scalar_one_or_none()
        if not app:
            raise NotFoundError("Appointment not found")
        return app

    async def update_status(self, clinic_id: uuid.UUID, appointment_id: uuid.UUID, data: StatusUpdate):
        app = await self.get_appointment(clinic_id, appointment_id)
        
        # State machine simple implementation
        valid_transitions = {
            "booked": ["checked_in", "cancelled", "no_show"],
            "checked_in": ["in_consultation", "cancelled", "no_show", "skipped"],
            "in_consultation": ["completed"],
            "completed": [],
            "cancelled": [],
            "no_show": [],
            "skipped": ["checked_in", "in_consultation"]
        }
        
        if data.status not in valid_transitions.get(app.status, []):
            raise ValidationError(f"Invalid transition from {app.status} to {data.status}")

        now = datetime.now(timezone.utc)
        if data.status == "checked_in":
            app.checked_in_at = now
        elif data.status == "in_consultation":
            app.consultation_started_at = now
        elif data.status == "completed":
            app.completed_at = now
            
        app.status = data.status
        await self.db.commit()
        await self.db.refresh(app)
        
        await self._announce(clinic_id, Events.APPOINTMENT_STATUS_CHANGED, app.id, status=app.status)
        
        if data.status == "cancelled":
            send_notification_task.delay(str(app.patient_id), "cancelled", {"date": str(app.appointment_date), "time": str(app.appointment_time), "doctor": "Dr."})
        
        return app

    async def reschedule(self, clinic_id: uuid.UUID, appointment_id: uuid.UUID, data: RescheduleRequest):
        app = await self.get_appointment(clinic_id, appointment_id)
        
        if app.status not in ["booked", "checked_in"]:
            raise ValidationError("Only booked or checked_in appointments can be rescheduled")
            
        # Re-validate slot
        doc_service = DoctorService(self.db)
        slots = await doc_service.get_available_slots(clinic_id, app.doctor_id, data.appointment_date)
        slot_valid = any(s["start_time"] == data.appointment_time for s in slots)
        if not slot_valid:
            raise ValidationError("Selected slot is not available")
            
        app.appointment_date = data.appointment_date
        app.appointment_time = data.appointment_time
        app.status = "booked"
        app.checked_in_at = None
        
        await self.db.commit()
        await self.db.refresh(app)
        
        send_notification_task.delay(str(app.patient_id), "rescheduled", {"date": str(data.appointment_date), "time": str(data.appointment_time), "doctor": "Dr."})
        await self._announce(clinic_id, Events.APPOINTMENT_RESCHEDULED, app.id)

        return app

    def _format_appointment(self, apt: Appointment) -> dict:
        return {
            "id": str(apt.id),
            "patientId": str(apt.patient_id),
            "doctorId": str(apt.doctor_id),
            "clinicId": str(apt.clinic_id),
            "appointmentDate": str(apt.appointment_date),
            "appointmentTime": apt.appointment_time.strftime("%H:%M") if hasattr(apt.appointment_time, 'strftime') else str(apt.appointment_time),
            "tokenNumber": apt.token_number,
            "queueNumber": apt.queue_number,
            "status": apt.status,
            "visitType": apt.visit_type,
            "notes": apt.notes,
            "patient": {
                "id": str(apt.patient.id),
                "patientCode": apt.patient.patient_code,
                "firstName": apt.patient.full_name,
                "lastName": "",
                "mobile": apt.patient.mobile,
                "email": apt.patient.email,
                "gender": apt.patient.gender,
                "dateOfBirth": str(apt.patient.dob) if apt.patient.dob else "",
                "createdAt": str(apt.patient.created_at)
            } if apt.patient else None,
            "doctor": {
                "id": str(apt.doctor.id),
                "userId": str(apt.doctor.user_id),
                "firstName": apt.doctor.user.full_name if (apt.doctor and apt.doctor.user) else "",
                "lastName": "",
                "specialization": apt.doctor.specialization if apt.doctor else "",
                "department": apt.doctor.department if apt.doctor else "",
                "consultationFee": float(apt.doctor.consultation_fee) if (apt.doctor and apt.doctor.consultation_fee) else 0.0,
                "isActive": apt.doctor.is_available if apt.doctor else True
            } if apt.doctor else None,
            "createdAt": str(apt.created_at)
        }

    async def get_queue_today(self, clinic_id: uuid.UUID, doctor_id: uuid.UUID = None):
        today = datetime.now(timezone.utc).date()
        stmt = select(Appointment).options(
            selectinload(Appointment.patient),
            selectinload(Appointment.doctor).selectinload(Doctor.user)
        ).where(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == today
        )
        if doctor_id:
            stmt = stmt.where(Appointment.doctor_id == doctor_id)
            
        stmt = stmt.order_by(Appointment.queue_number)
        items = (await self.db.execute(stmt)).scalars().all()
        
        response = {
            "current": None,
            "next": None,
            "waiting": [],
            "completed": [],
            "skipped": []
        }
        
        for item in items:
            formatted = self._format_appointment(item)
            if item.status in ["in_consultation", "IN_CONSULTATION"]:
                response["current"] = formatted
            elif item.status in ["checked_in", "CHECKED_IN"]:
                if not response["next"]:
                    response["next"] = formatted
                else:
                    response["waiting"].append(formatted)
            elif item.status in ["booked", "BOOKED", "scheduled", "SCHEDULED"]:
                response["waiting"].append(formatted)
            elif item.status in ["completed", "COMPLETED"]:
                response["completed"].append(formatted)
            elif item.status in ["skipped", "SKIPPED"]:
                response["skipped"].append(formatted)
            else:
                response["waiting"].append(formatted)
                
        return response
