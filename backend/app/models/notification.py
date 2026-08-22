from sqlalchemy import Column, String, Boolean, ForeignKey, JSON, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class NotificationTemplate(BaseModel):
    __tablename__ = "notification_templates"
    code = Column(String, unique=True, nullable=False)
    channel = Column(String, nullable=False) # whatsapp/sms/email
    body_template = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)

class Notification(BaseModel):
    __tablename__ = "notifications"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    recipient_phone = Column(String, nullable=False)
    channel = Column(String, nullable=False)
    template_code = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(String, default="queued") # queued/sent/delivered/failed
    error_message = Column(String, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    clinic = relationship("Clinic")
    patient = relationship("Patient")
