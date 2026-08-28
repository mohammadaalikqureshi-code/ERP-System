from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.models.user import User
from app.modules.appointments.schemas import (
    AppointmentCreate, AppointmentUpdate, AppointmentResponse, 
    StatusUpdate, RescheduleRequest, QueueResponse
)
from app.modules.appointments.service import AppointmentService

router = APIRouter(prefix="/appointments", tags=["Appointments"])

@router.post("", response_model=AppointmentResponse, dependencies=[Depends(require_permission("appointments.create"))])
async def create_appointment(
    data: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    return await AppointmentService(db).create_appointment(clinic_id, current_user.id, data)

@router.post("/doctor/start-next", dependencies=[Depends(require_permission("appointments.update"))])
async def start_next_consultation_endpoint(
    doctorId: uuid.UUID = None,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    return await AppointmentService(db).start_next_consultation(clinic_id, current_user.id, doctorId)

@router.get("/doctor/today", dependencies=[Depends(require_permission("appointments.read"))])
async def get_doctor_today_endpoint(
    doctorId: uuid.UUID = None,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    return await AppointmentService(db).get_doctor_today_appointments(clinic_id, current_user.id, doctorId)

@router.get("/queue", dependencies=[Depends(require_permission("appointments.read"))])
async def get_queue_endpoint(
    doctorId: uuid.UUID = None,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await AppointmentService(db).get_queue_today(clinic_id, doctorId)

@router.get("/queue/{doctor_id}/today", dependencies=[Depends(require_permission("appointments.read"))])
async def get_queue(
    doctor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await AppointmentService(db).get_queue_today(clinic_id, doctor_id)

@router.get("/{id}", response_model=AppointmentResponse, dependencies=[Depends(require_permission("appointments.read"))])
async def get_appointment(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await AppointmentService(db).get_appointment(clinic_id, id)

@router.patch("/{id}/status", response_model=AppointmentResponse, dependencies=[Depends(require_permission("appointments.update"))])
async def update_status(
    id: uuid.UUID,
    data: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await AppointmentService(db).update_status(clinic_id, id, data)

@router.post("/{id}/complete-and-call-next", dependencies=[Depends(require_permission("appointments.update"))])
async def complete_and_call_next_endpoint(
    id: uuid.UUID,
    doctorId: uuid.UUID = None,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    return await AppointmentService(db).complete_and_call_next(clinic_id, current_user.id, id, doctorId)

@router.patch("/{id}/reschedule", response_model=AppointmentResponse, dependencies=[Depends(require_permission("appointments.update"))])
async def reschedule_appointment(
    id: uuid.UUID,
    data: RescheduleRequest,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await AppointmentService(db).reschedule(clinic_id, id, data)
