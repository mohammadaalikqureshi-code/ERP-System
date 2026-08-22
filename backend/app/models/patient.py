from sqlalchemy import Column, String, ForeignKey, Date, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel, SoftDeleteMixin

class Patient(BaseModel, SoftDeleteMixin):
    __tablename__ = "patients"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    patient_code = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    mobile = Column(String, nullable=False)
    alt_mobile = Column(String, nullable=True)
    email = Column(String, nullable=True)
    dob = Column(Date, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=False)
    blood_group = Column(String, nullable=True)
    address = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    aadhaar_encrypted = Column(String, nullable=True)
    allergies = Column(String, nullable=True)

    __table_args__ = (
        Index('idx_clinic_mobile', 'clinic_id', 'mobile'),
    )

    clinic = relationship("Clinic")
