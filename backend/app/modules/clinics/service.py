from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.clinic import Clinic, Holiday, ClinicSettings
from app.modules.clinics.schemas import ClinicCreate, ClinicUpdate, HolidayCreate, ClinicSettingsUpdate
from app.core.exceptions import NotFoundError
import uuid

class ClinicService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_clinics(self):
        stmt = select(Clinic).where(Clinic.is_deleted == False)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_clinic(self, clinic_id: uuid.UUID):
        stmt = select(Clinic).where(Clinic.id == clinic_id, Clinic.is_deleted == False)
        result = await self.db.execute(stmt)
        clinic = result.scalar_one_or_none()
        if not clinic:
            raise NotFoundError("Clinic not found")
        return clinic

    async def create_clinic(self, data: ClinicCreate):
        clinic = Clinic(**data.model_dump())
        self.db.add(clinic)
        await self.db.flush()
        settings = ClinicSettings(clinic_id=clinic.id)
        self.db.add(settings)
        await self.db.commit()
        await self.db.refresh(clinic)
        return clinic

    async def update_clinic(self, clinic_id: uuid.UUID, data: ClinicUpdate):
        clinic = await self.get_clinic(clinic_id)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(clinic, k, v)
        await self.db.commit()
        await self.db.refresh(clinic)
        return clinic

    async def delete_clinic(self, clinic_id: uuid.UUID):
        clinic = await self.get_clinic(clinic_id)
        clinic.is_deleted = True
        clinic.is_active = False
        await self.db.commit()

    async def add_holiday(self, clinic_id: uuid.UUID, data: HolidayCreate):
        holiday = Holiday(clinic_id=clinic_id, **data.model_dump())
        self.db.add(holiday)
        await self.db.commit()
        await self.db.refresh(holiday)
        return holiday

    async def list_holidays(self, clinic_id: uuid.UUID):
        stmt = select(Holiday).where(Holiday.clinic_id == clinic_id).order_by(Holiday.date)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_settings(self, clinic_id: uuid.UUID):
        stmt = select(ClinicSettings).where(ClinicSettings.clinic_id == clinic_id)
        result = await self.db.execute(stmt)
        settings = result.scalar_one_or_none()
        if not settings:
            raise NotFoundError("Settings not found")
        return settings

    async def update_settings(self, clinic_id: uuid.UUID, data: ClinicSettingsUpdate):
        settings = await self.get_settings(clinic_id)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(settings, k, v)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings
