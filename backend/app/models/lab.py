from sqlalchemy import Column, String, ForeignKey, Float, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class LabTestCatalog(BaseModel):
    __tablename__ = "lab_test_catalog"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    test_name = Column(String, nullable=False)
    category = Column(String, nullable=False) # e.g., Hematology, Biochemistry
    price = Column(Float, nullable=False)
    normal_range = Column(String, nullable=True)
    # Reference range for auto-flagging
    unit = Column(String, nullable=True)  # mg/dL, mmol/L, g/dL, etc.
    reference_range_min = Column(Float, nullable=True)
    reference_range_max = Column(Float, nullable=True)
    critical_low = Column(Float, nullable=True)
    critical_high = Column(Float, nullable=True)
    method = Column(String, nullable=True)

    clinic = relationship("Clinic")

class LabOrder(BaseModel):
    __tablename__ = "lab_orders"
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=True)
    status = Column(String, default="pending") # pending, sample_collected, completed, cancelled

    patient = relationship("Patient")
    doctor = relationship("Doctor")
    appointment = relationship("Appointment")
    results = relationship("LabResult", back_populates="order", cascade="all, delete-orphan")

class LabResult(BaseModel):
    __tablename__ = "lab_results"
    order_id = Column(UUID(as_uuid=True), ForeignKey("lab_orders.id"), nullable=False)
    test_id = Column(UUID(as_uuid=True), ForeignKey("lab_test_catalog.id"), nullable=False)
    result_value = Column(String, nullable=True)
    remarks = Column(String, nullable=True)
    # Auto-flagging columns
    unit = Column(String, nullable=True)
    reference_range = Column(String, nullable=True)
    flag = Column(String, nullable=True)  # NORMAL, HIGH, LOW, CRITICAL_HIGH, CRITICAL_LOW
    is_abnormal = Column(Boolean, default=False)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    order = relationship("LabOrder", back_populates="results")
    test = relationship("LabTestCatalog")
