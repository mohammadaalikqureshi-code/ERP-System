from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.emr import Vitals, MedicalHistory, Prescription, PrescriptionItem, EMRTemplate
from app.modules.emr.schemas import VitalsCreate, VitalsUpdate, MedicalHistoryCreate, MedicalHistoryUpdate, PrescriptionCreate, EMRTemplateCreate, EMRTemplateUpdate
from uuid import UUID

class EMRService:
    @staticmethod
    def calculate_bmi(weight: float, height: float) -> float:
        if weight and height and height > 0:
            height_m = height / 100
            return round(weight / (height_m * height_m), 2)
        return None

    @staticmethod
    async def create_vitals(db: AsyncSession, vitals_data: VitalsCreate) -> Vitals:
        bmi = None
        if vitals_data.weight and vitals_data.height:
            bmi = EMRService.calculate_bmi(vitals_data.weight, vitals_data.height)
        
        db_vitals = Vitals(
            **vitals_data.model_dump(),
            bmi=bmi
        )
        db.add(db_vitals)
        await db.commit()
        await db.refresh(db_vitals)
        return db_vitals

    @staticmethod
    async def update_vitals(db: AsyncSession, vitals_id: UUID, vitals_data: VitalsUpdate) -> Vitals:
        result = await db.execute(select(Vitals).filter(Vitals.id == vitals_id))
        vitals = result.scalar_one_or_none()
        if not vitals:
            raise HTTPException(status_code=404, detail="Vitals not found")
        
        update_data = vitals_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(vitals, key, value)
            
        if vitals.weight and vitals.height:
            vitals.bmi = EMRService.calculate_bmi(vitals.weight, vitals.height)
            
        await db.commit()
        await db.refresh(vitals)
        return vitals

    @staticmethod
    async def get_vitals_by_appointment(db: AsyncSession, appointment_id: UUID) -> Vitals:
        result = await db.execute(select(Vitals).filter(Vitals.appointment_id == appointment_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_medical_history(db: AsyncSession, history_data: MedicalHistoryCreate) -> MedicalHistory:
        db_history = MedicalHistory(**history_data.model_dump())
        db.add(db_history)
        await db.commit()
        await db.refresh(db_history)
        return db_history

    @staticmethod
    async def get_patient_history(db: AsyncSession, patient_id: UUID) -> list[MedicalHistory]:
        result = await db.execute(select(MedicalHistory).filter(MedicalHistory.patient_id == patient_id))
        return list(result.scalars().all())

    @staticmethod
    async def create_prescription(db: AsyncSession, pres_data: PrescriptionCreate) -> Prescription:
        from app.models.appointment import Appointment
        from sqlalchemy import delete

        # Resolve patient_id and doctor_id from appointment if missing
        patient_id = pres_data.patient_id
        doctor_id = pres_data.doctor_id
        if not patient_id or not doctor_id:
            apt_stmt = select(Appointment).where(Appointment.id == pres_data.appointment_id)
            apt_row = (await db.execute(apt_stmt)).scalar_one_or_none()
            if apt_row:
                patient_id = patient_id or apt_row.patient_id
                doctor_id = doctor_id or apt_row.doctor_id

        # Determine prescription items list (support both items and medicines keys)
        raw_items = pres_data.items if (pres_data.items and len(pres_data.items) > 0) else (pres_data.medicines or [])

        # Check if a prescription already exists for this appointment
        existing_pres = (await db.execute(
            select(Prescription).where(Prescription.appointment_id == pres_data.appointment_id)
        )).scalars().first()

        if existing_pres:
            existing_pres.notes = pres_data.notes
            if patient_id:
                existing_pres.patient_id = patient_id
            if doctor_id:
                existing_pres.doctor_id = doctor_id
            
            # Delete old items to overwrite cleanly
            await db.execute(delete(PrescriptionItem).where(PrescriptionItem.prescription_id == existing_pres.id))
            
            for item in raw_items:
                dur = item.duration_days or item.duration or "5 Days"
                db_item = PrescriptionItem(
                    prescription_id=existing_pres.id,
                    medicine_name=item.medicine_name,
                    dosage=item.dosage,
                    frequency=item.frequency,
                    duration_days=dur,
                    instructions=item.instructions
                )
                db.add(db_item)
            
            await db.commit()
            db_prescription = existing_pres
        else:
            db_prescription = Prescription(
                appointment_id=pres_data.appointment_id,
                patient_id=patient_id,
                doctor_id=doctor_id,
                notes=pres_data.notes
            )
            db.add(db_prescription)
            await db.flush()
            
            for item in raw_items:
                dur = item.duration_days or item.duration or "5 Days"
                db_item = PrescriptionItem(
                    prescription_id=db_prescription.id,
                    medicine_name=item.medicine_name,
                    dosage=item.dosage,
                    frequency=item.frequency,
                    duration_days=dur,
                    instructions=item.instructions
                )
                db.add(db_item)
                
            await db.commit()
        
        # reload to get items
        result = await db.execute(
            select(Prescription)
            .options(selectinload(Prescription.items))
            .filter(Prescription.id == db_prescription.id)
        )
        saved_pres = result.scalar_one_or_none()

        # Notify Pharmacy
        try:
            from app.models.appointment import Appointment
            from app.modules.notifications.service import NotificationService
            from app.websockets.events import Events, build, room_for_clinic
            from app.websockets.queue_manager import manager

            apt = (await db.execute(select(Appointment).where(Appointment.id == db_prescription.appointment_id))).scalar_one_or_none()
            if apt:
                await manager.broadcast(
                    room_for_clinic(apt.clinic_id),
                    build(Events.PRESCRIPTION_CREATED, entity_id=db_prescription.id)
                )
                await NotificationService(db).create_and_broadcast(
                    clinic_id=apt.clinic_id,
                    title="New Prescription Issued",
                    message=f"Prescription with {len(pres_data.items)} medicine(s) prescribed for Token {apt.token_number}.",
                    category="pharmacy",
                    target_role="pharmacist",
                    sender_name="Doctor OPD",
                    link="/inventory",
                )
        except Exception:
            pass

        return saved_pres

    @staticmethod
    async def get_prescription_by_appointment(db: AsyncSession, appointment_id: UUID):
        result = await db.execute(
            select(Prescription)
            .options(selectinload(Prescription.items))
            .filter(Prescription.appointment_id == appointment_id)
        )
        pres = result.scalar_one_or_none()
        if not pres:
            return None
        return {
            "id": str(pres.id),
            "appointmentId": str(pres.appointment_id),
            "patientId": str(pres.patient_id),
            "doctorId": str(pres.doctor_id),
            "notes": pres.notes or "",
            "diagnosis": pres.diagnosis or "",
            "medicines": [
                {
                    "medicineName": i.medicine_name,
                    "dosage": i.dosage,
                    "frequency": i.frequency,
                    "duration": i.duration,
                    "instructions": i.instructions or ""
                }
                for i in (pres.items or [])
            ],
            "items": [
                {
                    "medicineName": i.medicine_name,
                    "dosage": i.dosage,
                    "frequency": i.frequency,
                    "duration": i.duration,
                    "instructions": i.instructions or ""
                }
                for i in (pres.items or [])
            ]
        }

    @staticmethod
    async def get_prescription(db: AsyncSession, prescription_id: UUID) -> Prescription:
        result = await db.execute(
            select(Prescription)
            .options(selectinload(Prescription.items))
            .filter(Prescription.id == prescription_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_template(db: AsyncSession, template_data: EMRTemplateCreate) -> EMRTemplate:
        db_template = EMRTemplate(**template_data.model_dump())
        db.add(db_template)
        await db.commit()
        await db.refresh(db_template)
        return db_template

    @staticmethod
    async def get_template(db: AsyncSession, template_id: UUID) -> EMRTemplate:
        result = await db.execute(select(EMRTemplate).filter(EMRTemplate.id == template_id))
        template = result.scalar_one_or_none()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template

    @staticmethod
    async def list_templates(db: AsyncSession, clinic_id: UUID) -> list[EMRTemplate]:
        result = await db.execute(select(EMRTemplate).filter(EMRTemplate.clinic_id == clinic_id))
        return list(result.scalars().all())

    @staticmethod
    async def update_template(db: AsyncSession, template_id: UUID, template_data: EMRTemplateUpdate) -> EMRTemplate:
        template = await EMRService.get_template(db, template_id)
        update_data = template_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(template, key, value)
        await db.commit()
        await db.refresh(template)
        return template

    @staticmethod
    async def delete_template(db: AsyncSession, template_id: UUID):
        template = await EMRService.get_template(db, template_id)
        await db.delete(template)
        await db.commit()
