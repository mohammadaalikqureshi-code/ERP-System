from sqlalchemy import Column, String, ForeignKey, Date, Time, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Appointment(BaseModel):
    __tablename__ = "appointments"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    department = Column(String, nullable=False)
    visit_type = Column(String, nullable=False) # enum: new/follow_up/emergency
    appointment_date = Column(Date, nullable=False)
    appointment_time = Column(Time, nullable=False)
    token_number = Column(String, nullable=False)
    queue_number = Column(Integer, nullable=False)
    status = Column(String, default="booked") # enum: booked/checked_in/in_consultation/completed/cancelled/no_show/skipped
    notes = Column(String, nullable=True)
    booked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reminder_24h_sent = Column(Boolean, default=False)
    reminder_2h_sent = Column(Boolean, default=False)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    consultation_started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    clinic = relationship("Clinic")
    branch = relationship("Branch", back_populates="appointments")
    patient = relationship("Patient")
    doctor = relationship("Doctor")
    user = relationship("User")
