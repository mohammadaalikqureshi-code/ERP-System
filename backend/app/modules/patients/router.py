from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.modules.patients.schemas import PatientCreate, PatientUpdate, PatientResponse, PatientListResponse
from app.modules.patients.service import PatientService

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=PatientListResponse, dependencies=[Depends(require_permission("patients.read"))])
async def list_patients(
    page: int = 1,
    size: int = 20,
    pageSize: int = 20,
    search: str = None,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    actual_size = pageSize if pageSize != 20 else size
    return await PatientService(db).list_patients(clinic_id, search or "", page, actual_size)

@router.get("", response_model=PatientListResponse, dependencies=[Depends(require_permission("patients.read"))])
async def list_patients(
    page: int = 1,
    size: int = 20,
    pageSize: int = 20,
    search: str = None,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    actual_size = pageSize if pageSize != 20 else size
    return await PatientService(db).list_patients(clinic_id, search or "", page, actual_size)

@router.post("", response_model=PatientResponse, dependencies=[Depends(require_permission("patients.create"))])
async def create_patient(
    data: PatientCreate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await PatientService(db).register_patient(clinic_id, data)

@router.get(
    "/search",
    response_model=List[PatientResponse],
    dependencies=[Depends(require_permission("patients.read"))],
)
async def search_patients(
    q: str,
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
):
    """Type-ahead search used by the booking and billing screens.

    Returns a plain list, not a paged envelope: this feeds a dropdown, and a
    dropdown has nothing to do with page numbers.
    """
    result = await PatientService(db).search_patients(clinic_id, q, page=1, size=limit)
    return result["items"]

@router.get("/{id}", response_model=PatientResponse, dependencies=[Depends(require_permission("patients.read"))])
async def get_patient(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await PatientService(db).get_patient(clinic_id, id)

@router.put("/{id}", response_model=PatientResponse, dependencies=[Depends(require_permission("patients.update"))])
async def update_patient(
    id: uuid.UUID,
    data: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await PatientService(db).update_patient(clinic_id, id, data)
