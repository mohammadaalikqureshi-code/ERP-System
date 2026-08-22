"""Patient records.

Two things here deserve a note:

* **Aadhaar is encrypted at rest** (`app.core.crypto`) and only ever leaves the
  API masked. Nothing in this file returns the full number.
* **Patient codes are generated from a Postgres sequence**, not from a row
  count. Counting rows means two receptionists registering at the same moment
  both get "PT-00042"; a sequence cannot collide.
"""

import uuid
from typing import Optional

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import encrypt, mask, try_decrypt
from app.core.exceptions import ConflictError, NotFoundError
from app.models.patient import Patient
from app.modules.patients.schemas import PatientCreate, PatientUpdate


class PatientService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _next_patient_code(self, clinic_id: uuid.UUID) -> str:
        """Allocate the next code for a clinic, safely under concurrency.

        Each clinic gets its own Postgres sequence, created on first use. If
        the clinic already has patients that were not numbered by the sequence
        (imported records, seed data), the sequence catches up to them rather
        than handing out a code that is already in use.
        """
        sequence = f"patient_code_{str(clinic_id).replace('-', '')}"
        await self.db.execute(text(f'CREATE SEQUENCE IF NOT EXISTS "{sequence}"'))
        number = int((await self.db.execute(text(f"SELECT nextval('{sequence}')"))).scalar())

        highest = int(
            (
                await self.db.execute(
                    text(
                        "SELECT COALESCE(MAX(NULLIF(regexp_replace(patient_code, '\\D', '', 'g'), '')::int), 0) "
                        "FROM patients WHERE clinic_id = :clinic_id"
                    ),
                    {"clinic_id": str(clinic_id)},
                )
            ).scalar()
            or 0
        )

        if number <= highest:
            number = highest + 1
            await self.db.execute(text(f"SELECT setval('{sequence}', :value)"), {"value": number})

        return f"PT-{number:05d}"

    @staticmethod
    def _masked_aadhaar(encrypted: Optional[str]) -> Optional[str]:
        if not encrypted:
            return None
        plain = try_decrypt(encrypted)
        return mask(plain, visible=4) if plain else None

    def _as_dict(self, patient: Patient) -> dict:
        """Shape a patient for the API, with the identifier masked."""
        name_parts = (patient.full_name or "").split(" ", 1)
        return {
            "id": patient.id,
            "clinic_id": patient.clinic_id,
            "patient_code": patient.patient_code,
            "full_name": patient.full_name,
            "first_name": name_parts[0],
            "last_name": name_parts[1] if len(name_parts) > 1 else "",
            "mobile": patient.mobile,
            "alt_mobile": patient.alt_mobile,
            "email": patient.email,
            "dob": patient.dob,
            "date_of_birth": str(patient.dob) if patient.dob else None,
            "age": patient.age,
            "gender": patient.gender,
            "blood_group": patient.blood_group,
            "address": patient.address,
            "emergency_contact": patient.emergency_contact,
            "aadhaar_number": self._masked_aadhaar(patient.aadhaar_encrypted),
            "allergies": patient.allergies,
            "created_at": patient.created_at,
        }

    async def register_patient(self, clinic_id: uuid.UUID, data: PatientCreate) -> dict:
        existing = (
            await self.db.execute(
                select(Patient).where(
                    Patient.clinic_id == clinic_id,
                    Patient.mobile == data.mobile,
                    Patient.is_deleted == False,  # noqa: E712
                )
            )
        ).scalar_one_or_none()
        if existing:
            raise ConflictError(
                f"A patient with this mobile number is already registered "
                f"({existing.patient_code} — {existing.full_name})."
            )

        values = data.model_dump(exclude={"aadhaar_number", "first_name", "last_name"})
        patient = Patient(
            clinic_id=clinic_id,
            patient_code=await self._next_patient_code(clinic_id),
            aadhaar_encrypted=encrypt(data.aadhaar_number) if data.aadhaar_number else None,
            **values,
        )

        self.db.add(patient)
        await self.db.commit()
        await self.db.refresh(patient)
        return self._as_dict(patient)

    async def list_patients(
        self, clinic_id: uuid.UUID, search: str = "", page: int = 1, size: int = 20
    ) -> dict:
        statement = select(Patient).where(
            Patient.clinic_id == clinic_id,
            Patient.is_deleted == False,  # noqa: E712
        )

        if search:
            term = f"%{search.strip()}%"
            statement = statement.where(
                or_(
                    Patient.mobile.ilike(term),
                    Patient.patient_code.ilike(term),
                    Patient.full_name.ilike(term),
                )
            )

        total = (
            await self.db.execute(select(func.count()).select_from(statement.subquery()))
        ).scalar() or 0

        rows = (
            await self.db.execute(
                statement.order_by(Patient.created_at.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        ).scalars().all()

        items = [self._as_dict(row) for row in rows]
        return {
            "items": items,
            "data": items,
            "total": total,
            "page": page,
            "size": size,
            "pageSize": size,
            "totalPages": max(1, (total + size - 1) // size),
        }

    async def search_patients(
        self, clinic_id: uuid.UUID, q: str, page: int = 1, size: int = 20
    ) -> dict:
        return await self.list_patients(clinic_id, q, page, size)

    async def _get_record(self, clinic_id: uuid.UUID, patient_id: uuid.UUID) -> Patient:
        patient = (
            await self.db.execute(
                select(Patient).where(
                    Patient.id == patient_id,
                    Patient.clinic_id == clinic_id,
                    Patient.is_deleted == False,  # noqa: E712
                )
            )
        ).scalar_one_or_none()
        if not patient:
            raise NotFoundError("Patient not found")
        return patient

    async def get_patient(self, clinic_id: uuid.UUID, patient_id: uuid.UUID) -> dict:
        return self._as_dict(await self._get_record(clinic_id, patient_id))

    async def update_patient(
        self, clinic_id: uuid.UUID, patient_id: uuid.UUID, data: PatientUpdate
    ) -> dict:
        patient = await self._get_record(clinic_id, patient_id)
        changes = data.model_dump(exclude_unset=True, exclude={"first_name", "last_name"})

        aadhaar = changes.pop("aadhaar_number", None)
        if aadhaar is not None:
            patient.aadhaar_encrypted = encrypt(aadhaar) if aadhaar else None

        for field, value in changes.items():
            setattr(patient, field, value)

        await self.db.commit()
        await self.db.refresh(patient)
        return self._as_dict(patient)

    async def delete_patient(self, clinic_id: uuid.UUID, patient_id: uuid.UUID) -> None:
        """Soft delete: medical records must never actually disappear."""
        patient = await self._get_record(clinic_id, patient_id)
        patient.is_deleted = True
        await self.db.commit()
