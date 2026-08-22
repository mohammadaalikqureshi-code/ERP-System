from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid
from datetime import date

from app.core.database import get_db
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.modules.doctors.schemas import (
    DoctorCreate, DoctorUpdate, DoctorResponse,
    ScheduleCreate, ScheduleResponse,
    LeaveCreate, LeaveResponse, AvailableSlotsResponse
)
from app.modules.doctors.service import DoctorService

router = APIRouter(prefix="/doctors", tags=["Doctors"])

@router.post("", response_model=DoctorResponse, dependencies=[Depends(require_permission("employees.create"))])
async def create_doctor(
    data: DoctorCreate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await DoctorService(db).create_doctor(clinic_id, data)

@router.get("", response_model=List[DoctorResponse])
async def list_doctors(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await DoctorService(db).list_doctors(clinic_id)

@router.get("/{id}", response_model=DoctorResponse)
async def get_doctor(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await DoctorService(db).get_doctor(clinic_id, id)

@router.put("/{id}", response_model=DoctorResponse, dependencies=[Depends(require_permission("employees.update"))])
async def update_doctor(
    id: uuid.UUID,
    data: DoctorUpdate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await DoctorService(db).update_doctor(clinic_id, id, data)

@router.post("/{id}/schedules", response_model=ScheduleResponse, dependencies=[Depends(require_permission("employees.update"))])
async def add_schedule(
    id: uuid.UUID,
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db)
):
    return await DoctorService(db).add_schedule(id, data)

@router.get("/{id}/schedules", response_model=List[ScheduleResponse])
async def get_schedules(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    return await DoctorService(db).get_schedules(id)

@router.post("/{id}/leaves", response_model=LeaveResponse)
async def add_leave(
    id: uuid.UUID,
    data: LeaveCreate,
    db: AsyncSession = Depends(get_db)
):
    return await DoctorService(db).add_leave(id, data)

@router.get("/{id}/leaves", response_model=List[LeaveResponse])
async def get_leaves(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    return await DoctorService(db).get_leaves(id)

@router.get("/{id}/slots", response_model=AvailableSlotsResponse)
@router.get("/{id}/available-slots", response_model=AvailableSlotsResponse, include_in_schema=False)
async def get_available_slots(
    id: uuid.UUID,
    target_date: date = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    slots = await DoctorService(db).get_available_slots(clinic_id, id, target_date)
    return AvailableSlotsResponse(date=target_date, slots=slots)
