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

    clinic = relationship("Clinic", back_populates="settings")
