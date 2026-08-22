from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.modules.dashboard.schemas import ReceptionDashboard, DoctorDashboard, AdminDashboard
from app.modules.dashboard.service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/reception", response_model=ReceptionDashboard, dependencies=[Depends(require_permission("dashboard.read"))])
async def get_reception_dashboard(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await DashboardService(db).get_reception_dashboard(clinic_id)

@router.get("/doctor", response_model=DoctorDashboard, dependencies=[Depends(require_permission("dashboard.read"))])
async def get_doctor_dashboard(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    # Retrieve doctor ID associated with current user
    from app.models.doctor import Doctor
    from sqlalchemy import select
    stmt = select(Doctor).where(Doctor.user_id == current_user.id)
    doc = (await db.execute(stmt)).scalar_one_or_none()
    doc_id = doc.id if doc else current_user.id # fallback for testing
    return await DashboardService(db).get_doctor_dashboard(clinic_id, doc_id)

@router.get("/admin", response_model=AdminDashboard, dependencies=[Depends(require_permission("dashboard.read"))])
async def get_admin_dashboard(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
):
    return await DashboardService(db).get_admin_dashboard(clinic_id)
