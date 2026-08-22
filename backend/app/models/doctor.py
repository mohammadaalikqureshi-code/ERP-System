from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Integer, Time, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel, SoftDeleteMixin

class Doctor(BaseModel, SoftDeleteMixin):
    __tablename__ = "doctors"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    specialization = Column(String, nullable=False)
    department = Column(String, nullable=False)
    qualification = Column(String, nullable=False)
    consultation_fee = Column(Numeric, nullable=False)
    avg_consultation_minutes = Column(Integer, default=15)
    signature_url = Column(String, nullable=True)
    is_available = Column(Boolean, default=True)

    user = relationship("User")
    schedules = relationship("DoctorSchedule", back_populates="doctor")
    leaves = relationship("DoctorLeave", back_populates="doctor")

class DoctorSchedule(BaseModel):
    __tablename__ = "doctor_schedules"
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False) # 0-6
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_duration_minutes = Column(Integer, default=15)
    break_start = Column(Time, nullable=True)
    break_end = Column(Time, nullable=True)

    doctor = relationship("Doctor", back_populates="schedules")

class DoctorLeave(BaseModel):
    __tablename__ = "doctor_leaves"
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    reason = Column(String, nullable=True)
    is_approved = Column(Boolean, default=True)

    doctor = relationship("Doctor", back_populates="leaves")
