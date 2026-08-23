from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.models.user import User
from app.modules.notifications.schemas import (
    NotificationListResponse,
    AppNotificationResponse,
    AppNotificationInboxResponse,
    SendNotificationRequest,
)
from app.modules.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/inbox", response_model=AppNotificationInboxResponse)
async def get_inbox(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve in-app notifications for the logged-in staff member."""
    return await NotificationService(db).get_inbox(clinic_id, current_user, page, size, unread_only)


@router.post("/send", response_model=AppNotificationResponse)
async def send_panel_notification(
    payload: SendNotificationRequest,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user),
):
    """Send a live in-app notification or inter-panel message/alert."""
    sender_name = current_user.full_name or current_user.email
    return await NotificationService(db).create_and_broadcast(
        clinic_id=clinic_id,
        title=payload.title,
        message=payload.message,
        category=payload.category,
        target_role=payload.target_role,
        sender_name=sender_name,
        sender_user_id=current_user.id,
        target_user_id=payload.target_user_id,
        target_doctor_id=payload.target_doctor_id,
        link=payload.link,
    )


@router.patch("/{id}/read", response_model=AppNotificationResponse)
async def mark_notification_read(
    id: uuid.UUID = Path(...),
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user),
):
    """Mark an individual in-app notification as read."""
    return await NotificationService(db).mark_as_read(clinic_id, id)


@router.patch("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user),
):
    """Mark all visible in-app notifications as read."""
    count = await NotificationService(db).mark_all_as_read(clinic_id, current_user)
    return {"status": "success", "updated_count": count}


@router.delete("/clear-all")
async def clear_all_notifications(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user),
):
    """Clear all in-app notifications for current user."""
    count = await NotificationService(db).clear_all(clinic_id, current_user)
    return {"status": "success", "deleted_count": count}


@router.delete("/{id}")
async def delete_notification(
    id: uuid.UUID = Path(...),
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user),
):
    """Delete / dismiss a specific notification."""
    success = await NotificationService(db).delete_notification(clinic_id, id)
    return {"status": "success" if success else "not_found"}


@router.get("", response_model=NotificationListResponse, dependencies=[Depends(require_permission("audit.read"))])
async def list_notifications(
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    """List external SMS/WhatsApp message dispatch logs."""
    return await NotificationService(db).list_notifications(clinic_id, page, size)

