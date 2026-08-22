from app.workers.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.notification import Notification, NotificationTemplate
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.modules.notifications.providers import MockWhatsAppProvider, MockSMSProvider
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import asyncio

async def _send_notification_async(patient_id: str, template_code: str, variables: dict, channel: str):
    async with AsyncSessionLocal() as db:
        patient = (await db.execute(select(Patient).where(Patient.id == patient_id))).scalar_one_or_none()
        if not patient:
            return
            
        template = (await db.execute(select(NotificationTemplate).where(NotificationTemplate.code == template_code))).scalar_one_or_none()
        if not template:
            return

        content = template.body_template.format(**variables)
        
        notif = Notification(
            clinic_id=patient.clinic_id,
            patient_id=patient.id,
            recipient_phone=patient.mobile,
            channel=channel,
            template_code=template_code,
            payload=variables
        )
        db.add(notif)
        
        provider = MockWhatsAppProvider() if channel == "whatsapp" else MockSMSProvider()
        success = await provider.send_message(patient.mobile, content)
        
        if success:
            notif.status = "sent"
            notif.sent_at = datetime.now(timezone.utc)
        else:
            notif.status = "failed"
            
        await db.commit()

@celery_app.task
def send_notification_task(patient_id: str, template_code: str, variables: dict, channel: str = "whatsapp"):
    asyncio.run(_send_notification_async(patient_id, template_code, variables, channel))

async def _scan_reminders_async(window_hours: int, flag_field: str):
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        target = now + timedelta(hours=window_hours)
        
        stmt = select(Appointment).where(
            getattr(Appointment, flag_field) == False,
            Appointment.status == "booked"
        )
        appointments = (await db.execute(stmt)).scalars().all()
        for app in appointments:
            app_dt = datetime.combine(app.appointment_date, app.appointment_time).replace(tzinfo=timezone.utc)
            if now <= app_dt <= target:
                setattr(app, flag_field, True)
                await _send_notification_async(
                    str(app.patient_id),
                    "reminder_24h" if window_hours == 24 else "reminder_2h",
                    {"date": str(app.appointment_date), "time": str(app.appointment_time), "doctor": "Dr."},
                    "whatsapp"
                )
        await db.commit()

@celery_app.task
def scan_24h_reminders():
    asyncio.run(_scan_reminders_async(24, "reminder_24h_sent"))

@celery_app.task
def scan_2h_reminders():
    asyncio.run(_scan_reminders_async(2, "reminder_2h_sent"))
