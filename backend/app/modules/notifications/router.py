from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.modules.notifications.schemas import NotificationListResponse
from app.modules.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=NotificationListResponse, dependencies=[Depends(require_permission("audit.read"))])
async def list_notifications(
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await NotificationService(db).list_notifications(clinic_id, page, size)
