from sqlalchemy import Column, String, ForeignKey, Date, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class Vitals(BaseModel):
    __tablename__ = "vitals"
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=False, unique=True)
    blood_pressure = Column(String, nullable=True) # e.g., 120/80
    weight = Column(Float, nullable=True) # in kg
    height = Column(Float, nullable=True) # in cm
    bmi = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True) # in F or C
    notes = Column(String, nullable=True)

    appointment = relationship("Appointment")

class MedicalHistory(BaseModel):
    __tablename__ = "medical_histories"
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    condition = Column(String, nullable=False)
    diagnosed_date = Column(Date, nullable=True)
    status = Column(String, nullable=False) # e.g., active, resolved, managing
    notes = Column(String, nullable=True)

    patient = relationship("Patient")

class Prescription(BaseModel):
    __tablename__ = "prescriptions"
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=False, unique=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    notes = Column(String, nullable=True)

    appointment = relationship("Appointment")
    patient = relationship("Patient")
    doctor = relationship("Doctor")
    items = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")

class PrescriptionItem(BaseModel):
    __tablename__ = "prescription_items"
    prescription_id = Column(UUID(as_uuid=True), ForeignKey("prescriptions.id"), nullable=False)
    medicine_name = Column(String, nullable=False)
    dosage = Column(String, nullable=False) # e.g., 500mg
    frequency = Column(String, nullable=False) # e.g., 1-0-1
    duration_days = Column(String, nullable=False) # e.g., 5 days
    instructions = Column(String, nullable=True) # e.g., After meals

    prescription = relationship("Prescription", back_populates="items")

class PatientDocument(BaseModel):
    __tablename__ = "patient_documents"
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=True)
    document_type = Column(String, nullable=False) # e.g., lab_report, scan, prescription
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    notes = Column(String, nullable=True)

    patient = relationship("Patient")
    appointment = relationship("Appointment")

class EMRTemplate(BaseModel):
    __tablename__ = "emr_templates"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    name = Column(String, nullable=False)
    specialty = Column(String, nullable=True) # e.g., "Cardiology"
    form_schema = Column(String, nullable=False) # JSON schema string
    is_active = Column(Boolean, default=True)

    clinic = relationship("Clinic")
