from sqlalchemy import Column, String, Boolean, ForeignKey, Date, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel, SoftDeleteMixin

class Clinic(BaseModel, SoftDeleteMixin):
    __tablename__ = "clinics"
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=False)
    gst_number = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    timezone = Column(String, default="Asia/Kolkata")
    currency = Column(String, default="INR")
    language = Column(String, default="en")
    working_days = Column(JSON, nullable=False, default=[]) # e.g. [1,2,3,4,5]
    is_active = Column(Boolean, default=True)
    # Branding & Registration
    tagline = Column(String, nullable=True)
    primary_color = Column(String, default="#0d9488")
    header_image_url = Column(String, nullable=True)
    footer_text = Column(String, nullable=True)
    registration_number = Column(String, nullable=True)
    drug_license_number = Column(String, nullable=True)

    settings = relationship("ClinicSettings", back_populates="clinic", uselist=False)
    holidays = relationship("Holiday", back_populates="clinic")
    branches = relationship("Branch", back_populates="clinic")

class Holiday(BaseModel):
    __tablename__ = "holidays"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    date = Column(Date, nullable=False)
    description = Column(String, nullable=True)

    clinic = relationship("Clinic", back_populates="holidays")

class ClinicSettings(BaseModel):
    __tablename__ = "clinic_settings"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, unique=True)
    gst_rate = Column(Numeric, default=18.0)
    session_timeout_minutes = Column(Numeric, default=30)
    # Split GST
    cgst_rate = Column(Numeric, default=9.0)
    sgst_rate = Column(Numeric, default=9.0)
    # Payment gateway
    razorpay_key_id = Column(String, nullable=True)
    razorpay_key_secret = Column(String, nullable=True)
    # SMS / WhatsApp
    sms_provider = Column(String, nullable=True)
    sms_api_key = Column(String, nullable=True)
    sms_sender_id = Column(String, nullable=True)
    whatsapp_enabled = Column(Boolean, default=False)
    auto_sms_appointment = Column(Boolean, default=True)
    auto_sms_prescription = Column(Boolean, default=True)
    auto_sms_lab_report = Column(Boolean, default=True)
    # TTS
    tts_enabled = Column(Boolean, default=True)
    tts_language = Column(String, default="en-IN")

    clinic = relationship("Clinic", back_populates="settings")
