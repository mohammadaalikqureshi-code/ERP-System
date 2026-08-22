"""Prescription PDFs.

Loads everything the document needs (clinic letterhead, patient, doctor,
medicines) and renders the shared template. Returns bytes — the caller decides
whether to stream it or attach it to an email.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.documents.pdf import render_pdf
from app.documents.templates import prescription_html
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.emr import Prescription


class PrescriptionPDFGenerator:
    @staticmethod
    async def build(db: AsyncSession, prescription_id: UUID) -> bytes:
        prescription = (
            await db.execute(
                select(Prescription)
                .options(
                    selectinload(Prescription.items),
                    selectinload(Prescription.patient),
                    selectinload(Prescription.doctor).selectinload(Doctor.user),
                )
                .where(Prescription.id == prescription_id)
            )
        ).scalar_one_or_none()

        if not prescription:
            raise NotFoundError("Prescription not found")

        patient = prescription.patient
        doctor = prescription.doctor

        clinic = (
            await db.execute(select(Clinic).where(Clinic.id == patient.clinic_id))
        ).scalar_one_or_none()

        html = prescription_html(
            clinic={
                "name": clinic.name if clinic else "Clinic",
                "address": clinic.address if clinic else "",
                "phone": clinic.phone if clinic else "",
                "email": clinic.email if clinic else "",
            },
            patient={
                "full_name": patient.full_name,
                "patient_code": patient.patient_code,
                "age": patient.age,
                "gender": patient.gender,
                "mobile": patient.mobile,
            },
            doctor={
                "name": doctor.user.full_name if doctor and doctor.user else "—",
                "department": doctor.department if doctor else "",
                "qualification": doctor.qualification if doctor else "",
            },
            prescription={
                "reference": str(prescription.id)[:8].upper(),
                "notes": prescription.notes,
            },
            medicines=[
                {
                    "medicine_name": item.medicine_name,
                    "dosage": item.dosage,
                    "frequency": item.frequency,
                    "duration_days": item.duration_days,
                    "instructions": item.instructions,
                }
                for item in prescription.items
            ],
        )
        return render_pdf(html)
