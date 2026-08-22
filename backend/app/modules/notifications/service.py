from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.notification import Notification, NotificationTemplate
from app.models.patient import Patient
import uuid
import json

class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_notifications(self, clinic_id: uuid.UUID, page: int = 1, size: int = 20):
        stmt = select(Notification).where(Notification.clinic_id == clinic_id)
        
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar() or 0
        
        stmt = stmt.offset((page - 1) * size).limit(size).order_by(Notification.created_at.desc())
        items = (await self.db.execute(stmt)).scalars().all()
        
        return {"items": items, "total": total, "page": page, "size": size}

    async def send(self, patient_id: uuid.UUID, template_code: str, variables: dict, channel: str = "whatsapp"):
        # Real logic dispatches celery task
        from app.workers.celery_app import celery_app
        celery_app.send_task(
            "app.modules.notifications.tasks.send_notification_task",
            args=[str(patient_id), template_code, variables, channel]
        )
