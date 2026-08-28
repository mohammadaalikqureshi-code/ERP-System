from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
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

    async def _generate_queue_number(self, doctor_id: uuid.UUID, target_date: any) -> int:
        if isinstance(target_date, str):
            from datetime import date as d_cls
            target_date = d_cls.fromisoformat(target_date)
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

        # STRICT GUARD: Check if patient already has an active appointment with this doctor on this date
        existing_apt = (await self.db.execute(
            select(Appointment).where(
                Appointment.clinic_id == clinic_id,
                Appointment.patient_id == data.patient_id,
                Appointment.doctor_id == data.doctor_id,
                Appointment.appointment_date == data.appointment_date,
                Appointment.status.in_(["booked", "checked_in", "in_consultation"])
            )
        )).scalar_one_or_none()
        if existing_apt:
            raise ValidationError(
                f"Patient already has an active Token #{existing_apt.token_number} with this doctor today (Status: {existing_apt.status.replace('_', ' ').title()}). Cannot generate a duplicate token."
            )

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

        try:
            from app.modules.notifications.service import NotificationService
            await NotificationService(self.db).create_and_broadcast(
                clinic_id=clinic_id,
                title="New Appointment Booked",
                message=f"Appointment booked for Token {appointment.token_number} on {appointment.appointment_date} at {appointment.appointment_time}.",
                category="appointment",
                target_role="doctor",
                target_doctor_id=appointment.doctor_id,
                sender_name="Front Desk / Reception",
                sender_user_id=user_id,
                link="/doctor",
            )
        except Exception:
            logger.warning("Failed to dispatch in-app booking notification", exc_info=True)

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
        
        try:
            from app.modules.notifications.service import NotificationService
            notif_service = NotificationService(self.db)
            if data.status == "checked_in":
                await notif_service.create_and_broadcast(
                    clinic_id=clinic_id,
                    title="Patient Checked In",
                    message=f"Patient with Token {app.token_number} is checked in and waiting in the lobby.",
                    category="clinical",
                    target_role="doctor",
                    target_doctor_id=app.doctor_id,
                    sender_name="Front Desk / Reception",
                    link="/doctor",
                )
            elif data.status == "in_consultation":
                await notif_service.create_and_broadcast(
                    clinic_id=clinic_id,
                    title="Consultation Started",
                    message=f"Doctor has called Token {app.token_number} into consultation.",
                    category="clinical",
                    target_role="receptionist",
                    sender_name="Doctor OPD",
                    link="/reception/queue",
                )
            elif data.status == "completed":
                await notif_service.create_and_broadcast(
                    clinic_id=clinic_id,
                    title="Consultation Completed",
                    message=f"Consultation for Token {app.token_number} has concluded.",
                    category="clinical",
                    target_role="receptionist",
                    sender_name="Doctor OPD",
                    link="/reception/billing",
                )
        except Exception:
            logger.warning("Failed to dispatch status change in-app notification", exc_info=True)

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

    async def get_doctor_today_appointments(self, clinic_id: uuid.UUID, user_id: uuid.UUID, doctor_id: uuid.UUID = None):
        """Returns all appointments today for the active doctor."""
        today = datetime.now(timezone.utc).date()
        if not doctor_id:
            doc = (await self.db.execute(select(Doctor).where(Doctor.user_id == user_id, Doctor.clinic_id == clinic_id))).scalar_one_or_none()
            if doc:
                doctor_id = doc.id
            else:
                doc_first = (await self.db.execute(select(Doctor).where(Doctor.clinic_id == clinic_id).limit(1))).scalar_one_or_none()
                if doc_first:
                    doctor_id = doc_first.id

        if not doctor_id:
            return []

        stmt = select(Appointment).options(
            selectinload(Appointment.patient),
            selectinload(Appointment.doctor).selectinload(Doctor.user)
        ).where(
            Appointment.clinic_id == clinic_id,
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == today
        ).order_by(Appointment.queue_number, Appointment.appointment_time)

        items = (await self.db.execute(stmt)).scalars().all()
        return [self._format_appointment(item) for item in items]

    async def start_next_consultation(self, clinic_id: uuid.UUID, user_id: uuid.UUID, doctor_id: uuid.UUID = None):
        """Finds or starts the next consultation for the given doctor/user."""
        today = datetime.now(timezone.utc).date()
        
        # 1. Resolve doctor_id
        if not doctor_id:
            doc_stmt = select(Doctor).where(Doctor.user_id == user_id, Doctor.clinic_id == clinic_id)
            doc_res = await self.db.execute(doc_stmt)
            doc = doc_res.scalar_one_or_none()
            if doc:
                doctor_id = doc.id
            else:
                doc_first = (await self.db.execute(select(Doctor).where(Doctor.clinic_id == clinic_id).limit(1))).scalar_one_or_none()
                if doc_first:
                    doctor_id = doc_first.id

        if not doctor_id:
            raise ValidationError("No doctor profile found for current user")

        # 2. Check if a consultation is already in progress
        in_prog_stmt = select(Appointment).options(
            selectinload(Appointment.patient),
            selectinload(Appointment.doctor).selectinload(Doctor.user)
        ).where(
            Appointment.clinic_id == clinic_id,
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == today,
            Appointment.status.in_(["in_consultation", "IN_CONSULTATION"])
        ).order_by(Appointment.queue_number)
        
        in_prog = (await self.db.execute(in_prog_stmt)).scalar_one_or_none()
        if in_prog:
            return self._format_appointment(in_prog)

        # 3. Look for next checked-in patient
        checked_in_stmt = select(Appointment).options(
            selectinload(Appointment.patient),
            selectinload(Appointment.doctor).selectinload(Doctor.user)
        ).where(
            Appointment.clinic_id == clinic_id,
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == today,
            Appointment.status.in_(["checked_in", "CHECKED_IN"])
        ).order_by(Appointment.queue_number)
        
        next_app = (await self.db.execute(checked_in_stmt)).scalars().first()

        # 4. If none checked-in, look for booked/scheduled patient
        if not next_app:
            booked_stmt = select(Appointment).options(
                selectinload(Appointment.patient),
                selectinload(Appointment.doctor).selectinload(Doctor.user)
            ).where(
                Appointment.clinic_id == clinic_id,
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_date == today,
                Appointment.status.in_(["booked", "BOOKED", "scheduled", "SCHEDULED"])
            ).order_by(Appointment.queue_number, Appointment.appointment_time)
            next_app = (await self.db.execute(booked_stmt)).scalars().first()

        if not next_app:
            raise NotFoundError("No pending appointments or waiting patients found for today.")

        # 5. Transition to in_consultation
        now = datetime.now(timezone.utc)
        next_app.status = "in_consultation"
        next_app.consultation_started_at = now
        await self.db.commit()
        await self.db.refresh(next_app)

        # Broadcast live websocket events to waiting room TV & staff
        await self._announce(clinic_id, Events.APPOINTMENT_STATUS_CHANGED, next_app.id, status="in_consultation", tokenNumber=next_app.token_number)

        try:
            from app.modules.notifications.service import NotificationService
            patient_name = next_app.patient.full_name if next_app.patient else "Patient"
            await NotificationService(self.db).create_and_broadcast(
                clinic_id=clinic_id,
                title="Consultation Started",
                message=f"Token {next_app.token_number} ({patient_name}) called into Doctor OPD consultation room.",
                category="clinical",
                target_role="receptionist",
                sender_name="Doctor OPD",
                link="/reception/queue",
            )
        except Exception:
            logger.warning("Failed to broadcast start consultation notification", exc_info=True)

        return self._format_appointment(next_app)

    async def complete_and_call_next(self, clinic_id: uuid.UUID, user_id: uuid.UUID, appointment_id: uuid.UUID, doctor_id: uuid.UUID = None):
        """Atomically finishes the current consultation and automatically calls the next waiting patient."""
        # 1. Complete current appointment
        current_app = (await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id, Appointment.clinic_id == clinic_id)
        )).scalar_one_or_none()
        
        if not current_app:
            raise NotFoundError("Appointment not found")

        now = datetime.now(timezone.utc)
        current_app.status = "completed"
        current_app.completed_at = now
        resolved_doctor_id = doctor_id or current_app.doctor_id
        await self.db.commit()
        await self.db.refresh(current_app)

        # Broadcast completed status
        await self._announce(clinic_id, Events.APPOINTMENT_STATUS_CHANGED, current_app.id, status="completed", tokenNumber=current_app.token_number)

        # 2. Automatically find and call the next patient in queue
        next_app = None
        has_next = False
        try:
            next_app = await self.start_next_consultation(clinic_id, user_id, resolved_doctor_id)
            has_next = True
            msg = f"Consultation #{current_app.token_number} completed. Next Token #{next_app.get('tokenNumber')} called to room."
        except NotFoundError:
            has_next = False
            msg = f"Consultation #{current_app.token_number} completed. No more waiting patients in queue for today."

        return {
            "completed_appointment_id": str(current_app.id),
            "completed_token_number": current_app.token_number,
            "has_next": has_next,
            "next_appointment": next_app,
            "message": msg
        }

    async def create_quick_walkin(self, clinic_id: uuid.UUID, user_id: uuid.UUID, data: any):
        """Express 10-Second Quick Walk-in Token Generator for Receptionists."""
        today = datetime.now(timezone.utc).date()
        clean_mobile = data.mobile.strip().replace(" ", "").replace("-", "")

        # 1. Lookup or create patient (Recognizing Name, Mobile, Age, Blood Group)
        patient = None
        if clean_mobile:
            patient = (await self.db.execute(
                select(Patient).where(Patient.clinic_id == clinic_id, Patient.mobile == clean_mobile)
            )).scalar_one_or_none()

        # If not found by mobile, lookup by exact Name, Age, and Blood Group in this clinic
        if not patient and data.full_name:
            clean_name = data.full_name.strip()
            name_query = select(Patient).where(
                Patient.clinic_id == clinic_id,
                func.lower(Patient.full_name) == clean_name.lower()
            )
            if data.age:
                name_query = name_query.where(Patient.age == data.age)
            if data.blood_group:
                name_query = name_query.where(Patient.blood_group == data.blood_group)
            
            patient = (await self.db.execute(name_query)).scalar_one_or_none()

        is_new_patient = False
        if not patient:
            is_new_patient = True
            count_patients = (await self.db.execute(
                select(func.count(Patient.id)).where(Patient.clinic_id == clinic_id)
            )).scalar() or 0
            code = f"PT-{count_patients + 10001}"
            patient = Patient(
                clinic_id=clinic_id,
                patient_code=code,
                full_name=data.full_name or "Walk-in Patient",
                mobile=clean_mobile,
                age=data.age or 30,
                gender=data.gender or "male",
                blood_group=data.blood_group or "O+"
            )
            self.db.add(patient)
            await self.db.commit()
            await self.db.refresh(patient)
        else:
            # Keep patient record synchronized with verified demographics
            updated = False
            if data.full_name and patient.full_name != data.full_name:
                patient.full_name = data.full_name
                updated = True
            if data.age and patient.age != data.age:
                patient.age = data.age
                updated = True
            if data.gender and patient.gender != data.gender:
                patient.gender = data.gender
                updated = True
            if data.blood_group and patient.blood_group != data.blood_group:
                patient.blood_group = data.blood_group
                updated = True
            if clean_mobile and patient.mobile != clean_mobile:
                patient.mobile = clean_mobile
                updated = True
            if updated:
                await self.db.commit()
                await self.db.refresh(patient)

        # 2. Get Doctor details
        doctor = (await self.db.execute(
            select(Doctor).options(selectinload(Doctor.user)).where(Doctor.id == data.doctor_id)
        )).scalar_one_or_none()
        if not doctor:
            raise NotFoundError("Doctor not found")

        dept = data.department or doctor.department or "General OPD"
        doc_full_name = doctor.user.full_name if doctor.user else "Doctor"

        # 3. 🚨 STRICT GUARD: Check if patient ALREADY has an active token for this doctor today
        existing_apt = (await self.db.execute(
            select(Appointment).where(
                Appointment.clinic_id == clinic_id,
                Appointment.patient_id == patient.id,
                Appointment.doctor_id == doctor.id,
                Appointment.appointment_date == today,
                Appointment.status.in_(["checked_in", "in_consultation", "booked"])
            ).order_by(Appointment.queue_number)
        )).scalar_one_or_none()

        if existing_apt:
            # Calculate wait time for the existing active token
            patients_ahead_count = (await self.db.execute(
                select(func.count(Appointment.id)).where(
                    Appointment.clinic_id == clinic_id,
                    Appointment.doctor_id == doctor.id,
                    Appointment.appointment_date == today,
                    Appointment.queue_number < existing_apt.queue_number,
                    Appointment.status.in_(["checked_in", "in_consultation"])
                )
            )).scalar() or 0
            avg_mins = doctor.avg_consultation_minutes or 12
            est_wait_mins = patients_ahead_count * avg_mins

            return {
                "id": str(existing_apt.id),
                "token_number": existing_apt.token_number,
                "queue_number": existing_apt.queue_number,
                "status": existing_apt.status,
                "appointment_date": str(existing_apt.appointment_date),
                "appointment_time": str(existing_apt.appointment_time)[:5],
                "is_duplicate_prevented": True,
                "patient": {
                    "id": str(patient.id),
                    "patient_code": patient.patient_code,
                    "full_name": patient.full_name,
                    "mobile": patient.mobile,
                    "age": patient.age,
                    "gender": patient.gender,
                    "blood_group": patient.blood_group,
                    "is_new": False
                },
                "doctor": {
                    "id": str(doctor.id),
                    "full_name": doc_full_name,
                    "department": doctor.department,
                    "specialization": doctor.specialization,
                    "consultation_fee": float(doctor.consultation_fee) if doctor.consultation_fee else 500.0,
                    "room": "Room 101"
                },
                "queue_stats": {
                    "patients_ahead": patients_ahead_count,
                    "estimated_wait_minutes": est_wait_mins,
                    "estimated_wait_formatted": f"~{est_wait_mins} mins ({patients_ahead_count} ahead)" if patients_ahead_count > 0 else "Next in line! (0 mins)"
                },
                "message": f"Active Token #{existing_apt.token_number} already exists today for {patient.full_name} with Dr. {doc_full_name} (Status: {existing_apt.status.replace('_', ' ').title()}). Duplicate generation blocked."
            }

        # 4. Calculate queue & generate new token
        queue_num = await self._generate_queue_number(doctor.id, today)
        token_prefix = "EMG" if data.is_emergency else "A"
        token_number = f"{token_prefix}-{queue_num:03d}"
        now = datetime.now(timezone.utc)

        appointment = Appointment(
            clinic_id=clinic_id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            department=dept,
            visit_type="emergency" if data.is_emergency else data.visit_type,
            appointment_date=today,
            appointment_time=now.time(),
            token_number=token_number,
            queue_number=queue_num,
            status="checked_in",
            booked_by=user_id,
            checked_in_at=now,
            notes=data.notes
        )
        self.db.add(appointment)
        await self.db.commit()
        await self.db.refresh(appointment)

        # 4. Calculate estimated wait time (patients ahead)
        patients_ahead_count = (await self.db.execute(
            select(func.count(Appointment.id)).where(
                Appointment.clinic_id == clinic_id,
                Appointment.doctor_id == doctor.id,
                Appointment.appointment_date == today,
                Appointment.queue_number < queue_num,
                Appointment.status.in_(["checked_in", "in_consultation"])
            )
        )).scalar() or 0

        avg_mins = doctor.avg_consultation_minutes or 12
        est_wait_mins = patients_ahead_count * avg_mins

        # 5. Broadcast to waiting room TV display and staff
        await self._announce(clinic_id, Events.APPOINTMENT_CREATED, appointment.id, token_number=appointment.token_number)
        await self._announce(clinic_id, Events.APPOINTMENT_STATUS_CHANGED, appointment.id, status="checked_in", tokenNumber=appointment.token_number)

        try:
            from app.modules.notifications.service import NotificationService
            doc_name = f"Dr. {doctor.user.full_name}" if doctor.user else "Doctor"
            await NotificationService(self.db).create_and_broadcast(
                clinic_id=clinic_id,
                title="New Patient Arrived",
                message=f"Walk-in Token #{token_number} ({patient.full_name}) registered for {doc_name} ({dept}).",
                category="queue",
                target_role="doctor",
                sender_name="Front Desk Reception",
                link="/doctor",
            )
        except Exception:
            logger.warning("Failed to broadcast quick walkin notification", exc_info=True)

        return {
            "id": str(appointment.id),
            "token_number": appointment.token_number,
            "queue_number": appointment.queue_number,
            "status": appointment.status,
            "appointment_date": str(appointment.appointment_date),
            "appointment_time": str(appointment.appointment_time)[:5],
            "patient": {
                "id": str(patient.id),
                "patient_code": patient.patient_code,
                "full_name": patient.full_name,
                "mobile": patient.mobile,
                "age": patient.age,
                "gender": patient.gender,
                "blood_group": patient.blood_group,
                "is_new": is_new_patient
            },
            "doctor": {
                "id": str(doctor.id),
                "full_name": doctor.user.full_name if doctor.user else "Doctor",
                "department": doctor.department,
                "specialization": doctor.specialization,
                "consultation_fee": float(doctor.consultation_fee) if doctor.consultation_fee else 500.0,
                "room": "Room 101"
            },
            "queue_stats": {
                "patients_ahead": patients_ahead_count,
                "estimated_wait_minutes": est_wait_mins,
                "estimated_wait_formatted": f"~{est_wait_mins} mins ({patients_ahead_count} ahead)" if patients_ahead_count > 0 else "Next in line! (0 mins)"
            },
            "message": f"Token #{token_number} generated successfully for {patient.full_name}."
        }
