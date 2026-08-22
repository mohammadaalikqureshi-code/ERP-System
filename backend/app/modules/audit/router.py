from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.modules.audit.schemas import AuditLogListResponse, AuditLogFilter
from app.modules.audit.service import AuditService

router = APIRouter(prefix="/audit", tags=["Audit"])

@router.get("", response_model=AuditLogListResponse, dependencies=[Depends(require_permission("audit.read"))])
async def list_audit_logs(
    filters: AuditLogFilter = Depends(),
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await AuditService(db).list_audit_logs(clinic_id, filters, page, size)
