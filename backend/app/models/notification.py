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


class AppNotification(BaseModel):
    """In-app live notification for staff across panels (Doctor, Reception, Lab, Pharmacy, Admin)."""
    __tablename__ = "app_notifications"

    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    sender_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    sender_name = Column(String, nullable=False, default="System")
    target_role = Column(String, nullable=False, default="all")  # doctor, receptionist, lab_staff, pharmacist, clinic_admin, super_admin, nurse, all
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    target_doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True)
    category = Column(String, nullable=False, default="general")  # appointment, clinical, lab, pharmacy, billing, urgent, general
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    clinic = relationship("Clinic")
    sender = relationship("User", foreign_keys=[sender_user_id])
    target_user = relationship("User", foreign_keys=[target_user_id])

