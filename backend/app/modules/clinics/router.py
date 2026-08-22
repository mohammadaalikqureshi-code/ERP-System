from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from app.core.database import get_db
from app.middleware.rbac import require_permission
from app.modules.clinics.schemas import (
    ClinicCreate, ClinicUpdate, ClinicResponse,
    HolidayCreate, HolidayResponse,
    ClinicSettingsUpdate, ClinicSettingsResponse
)
from app.modules.clinics.service import ClinicService

router = APIRouter(prefix="/clinics", tags=["Clinics"])

@router.get("", response_model=List[ClinicResponse], dependencies=[Depends(require_permission("clinics.read"))])
async def list_clinics(db: AsyncSession = Depends(get_db)):
    return await ClinicService(db).list_clinics()

@router.get("/{id}", response_model=ClinicResponse, dependencies=[Depends(require_permission("clinics.read"))])
async def get_clinic(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await ClinicService(db).get_clinic(id)

@router.post("", response_model=ClinicResponse, dependencies=[Depends(require_permission("clinics.create"))])
async def create_clinic(data: ClinicCreate, db: AsyncSession = Depends(get_db)):
    return await ClinicService(db).create_clinic(data)

@router.put("/{id}", response_model=ClinicResponse, dependencies=[Depends(require_permission("clinics.update"))])
async def update_clinic(id: uuid.UUID, data: ClinicUpdate, db: AsyncSession = Depends(get_db)):
    return await ClinicService(db).update_clinic(id, data)

@router.delete("/{id}", dependencies=[Depends(require_permission("clinics.delete"))])
async def delete_clinic(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await ClinicService(db).delete_clinic(id)
    return {"status": "deleted"}

@router.get("/{id}/holidays", response_model=List[HolidayResponse], dependencies=[Depends(require_permission("clinics.read"))])
async def get_holidays(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await ClinicService(db).list_holidays(id)

@router.post("/{id}/holidays", response_model=HolidayResponse, dependencies=[Depends(require_permission("clinics.update"))])
async def add_holiday(id: uuid.UUID, data: HolidayCreate, db: AsyncSession = Depends(get_db)):
    return await ClinicService(db).add_holiday(id, data)

@router.get("/{id}/settings", response_model=ClinicSettingsResponse, dependencies=[Depends(require_permission("settings.read"))])
async def get_settings(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await ClinicService(db).get_settings(id)

@router.put("/{id}/settings", response_model=ClinicSettingsResponse, dependencies=[Depends(require_permission("settings.update"))])
async def update_settings(id: uuid.UUID, data: ClinicSettingsUpdate, db: AsyncSession = Depends(get_db)):
    return await ClinicService(db).update_settings(id, data)
