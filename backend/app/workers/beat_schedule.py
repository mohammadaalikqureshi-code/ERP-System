from celery.schedules import crontab
from app.workers.celery_app import celery_app

celery_app.conf.beat_schedule = {
    "scan-24h-reminders": {
        "task": "app.modules.notifications.tasks.scan_24h_reminders",
        "schedule": crontab(minute="*/15"),
    },
    "scan-2h-reminders": {
        "task": "app.modules.notifications.tasks.scan_2h_reminders",
        "schedule": crontab(minute="*/5"),
    }
}
