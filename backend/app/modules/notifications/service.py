from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, update, delete
from datetime import datetime, timezone
import uuid
import logging
from typing import Optional, List

from app.models.notification import Notification, NotificationTemplate, AppNotification
from app.models.doctor import Doctor
from app.models.user import User
from app.websockets.queue_manager import manager
from app.websockets.events import Events, build, room_for_clinic
from app.core.exceptions import NotFoundError

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_and_broadcast(
        self,
        clinic_id: uuid.UUID,
        title: str,
        message: str,
        category: str = "general",
        target_role: str = "all",
        sender_name: str = "System",
        sender_user_id: Optional[uuid.UUID] = None,
        target_user_id: Optional[uuid.UUID] = None,
        target_doctor_id: Optional[uuid.UUID] = None,
        link: Optional[str] = None,
    ) -> AppNotification:
        """Create an in-app notification in DB and broadcast via WebSocket to the clinic room."""
        notification = AppNotification(
            clinic_id=clinic_id,
            sender_user_id=sender_user_id,
            sender_name=sender_name,
            target_role=target_role,
            target_user_id=target_user_id,
            target_doctor_id=target_doctor_id,
            category=category,
            title=title,
            message=message,
            link=link,
            is_read=False,
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)

        # Broadcast real-time event to staff WebSocket room
        payload = {
            "id": str(notification.id),
            "clinicId": str(notification.clinic_id),
            "senderName": notification.sender_name,
            "senderUserId": str(notification.sender_user_id) if notification.sender_user_id else None,
            "targetRole": notification.target_role,
            "targetUserId": str(notification.target_user_id) if notification.target_user_id else None,
            "targetDoctorId": str(notification.target_doctor_id) if notification.target_doctor_id else None,
            "category": notification.category,
            "title": notification.title,
            "message": notification.message,
            "link": notification.link,
            "isRead": False,
            "createdAt": notification.created_at.isoformat() if notification.created_at else datetime.now(timezone.utc).isoformat(),
        }

        try:
            await manager.broadcast(
                room_for_clinic(clinic_id),
                build(Events.NOTIFICATION_RECEIVED, entity_id=notification.id, **payload)
            )
        except Exception:
            logger.warning("Could not broadcast notification event", exc_info=True)

        return notification

    async def get_inbox(
        self,
        clinic_id: uuid.UUID,
        user: User,
        page: int = 1,
        size: int = 50,
        unread_only: bool = False,
    ):
        """Fetch in-app notifications relevant to the current user's role/id."""
        user_role = user.role.name if user.role else "unknown"

        # Find doctor_id if user is a doctor
        doctor_id = None
        if user_role == "doctor":
            doc_stmt = select(Doctor.id).where(Doctor.user_id == user.id)
            doctor_id = (await self.db.execute(doc_stmt)).scalar_one_or_none()

        # Build condition for targeting
        filters = [AppNotification.clinic_id == clinic_id]

        if user_role in ("super_admin", "clinic_admin"):
            # Admins see all clinic notifications
            pass
        else:
            role_conditions = [
                AppNotification.target_role == "all",
                AppNotification.target_role == user_role,
                AppNotification.target_user_id == user.id,
            ]
            if doctor_id:
                role_conditions.append(AppNotification.target_doctor_id == doctor_id)
            filters.append(or_(*role_conditions))

        if unread_only:
            filters.append(AppNotification.is_read == False)

        # Count total
        count_stmt = select(func.count(AppNotification.id)).where(and_(*filters))
        total = (await self.db.execute(count_stmt)).scalar() or 0

        # Count unread (always computed against all user-visible notifications)
        unread_filters = [AppNotification.clinic_id == clinic_id, AppNotification.is_read == False]
        if user_role not in ("super_admin", "clinic_admin"):
            role_conditions = [
                AppNotification.target_role == "all",
                AppNotification.target_role == user_role,
                AppNotification.target_user_id == user.id,
            ]
            if doctor_id:
                role_conditions.append(AppNotification.target_doctor_id == doctor_id)
            unread_filters.append(or_(*role_conditions))

        unread_count_stmt = select(func.count(AppNotification.id)).where(and_(*unread_filters))
        unread_count = (await self.db.execute(unread_count_stmt)).scalar() or 0

        # Fetch items
        items_stmt = (
            select(AppNotification)
            .where(and_(*filters))
            .order_by(AppNotification.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        items = (await self.db.execute(items_stmt)).scalars().all()

        return {
            "items": items,
            "unread_count": unread_count,
            "total": total,
        }

    async def mark_as_read(self, clinic_id: uuid.UUID, notification_id: uuid.UUID) -> AppNotification:
        stmt = select(AppNotification).where(
            AppNotification.id == notification_id,
            AppNotification.clinic_id == clinic_id,
        )
        notif = (await self.db.execute(stmt)).scalar_one_or_none()
        if not notif:
            raise NotFoundError("Notification not found")

        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(notif)
        return notif

    async def mark_all_as_read(self, clinic_id: uuid.UUID, user: User) -> int:
        user_role = user.role.name if user.role else "unknown"
        doctor_id = None
        if user_role == "doctor":
            doc_stmt = select(Doctor.id).where(Doctor.user_id == user.id)
            doctor_id = (await self.db.execute(doc_stmt)).scalar_one_or_none()

        filters = [AppNotification.clinic_id == clinic_id, AppNotification.is_read == False]
        if user_role not in ("super_admin", "clinic_admin"):
            role_conditions = [
                AppNotification.target_role == "all",
                AppNotification.target_role == user_role,
                AppNotification.target_user_id == user.id,
            ]
            if doctor_id:
                role_conditions.append(AppNotification.target_doctor_id == doctor_id)
            filters.append(or_(*role_conditions))

        stmt = (
            update(AppNotification)
            .where(and_(*filters))
            .values(is_read=True, read_at=datetime.now(timezone.utc))
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount

    async def delete_notification(self, clinic_id: uuid.UUID, notification_id: uuid.UUID) -> bool:
        stmt = delete(AppNotification).where(
            AppNotification.id == notification_id,
            AppNotification.clinic_id == clinic_id,
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount > 0

    async def clear_all(self, clinic_id: uuid.UUID, user: User) -> int:
        user_role = user.role.name if user.role else "unknown"
        doctor_id = None
        if user_role == "doctor":
            doc_stmt = select(Doctor.id).where(Doctor.user_id == user.id)
            doctor_id = (await self.db.execute(doc_stmt)).scalar_one_or_none()

        filters = [AppNotification.clinic_id == clinic_id]
        if user_role not in ("super_admin", "clinic_admin"):
            role_conditions = [
                AppNotification.target_role == "all",
                AppNotification.target_role == user_role,
                AppNotification.target_user_id == user.id,
            ]
            if doctor_id:
                role_conditions.append(AppNotification.target_doctor_id == doctor_id)
            filters.append(or_(*role_conditions))

        stmt = delete(AppNotification).where(and_(*filters))
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount

    async def list_notifications(self, clinic_id: uuid.UUID, page: int = 1, size: int = 20):
        stmt = select(Notification).where(Notification.clinic_id == clinic_id)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar() or 0
        stmt = stmt.offset((page - 1) * size).limit(size).order_by(Notification.created_at.desc())
        items = (await self.db.execute(stmt)).scalars().all()
        return {"items": items, "total": total, "page": page, "size": size}

    async def send(self, patient_id: uuid.UUID, template_code: str, variables: dict, channel: str = "whatsapp"):
        from app.workers.celery_app import celery_app
        celery_app.send_task(
            "app.modules.notifications.tasks.send_notification_task",
            args=[str(patient_id), template_code, variables, channel]
        )

