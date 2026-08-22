from sqlalchemy import Column, String, ForeignKey, Numeric, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel, SoftDeleteMixin

class Bill(BaseModel, SoftDeleteMixin):
    __tablename__ = "bills"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=True)
    bill_number = Column(String, nullable=False)
    bill_type = Column(String, nullable=False) # enum: consultation/lab/medicine/procedure
    line_items = Column(JSON, nullable=False)
    subtotal = Column(Numeric, nullable=False)
    discount_amount = Column(Numeric, default=0)
    gst_amount = Column(Numeric, nullable=False)
    total_amount = Column(Numeric, nullable=False)
    payment_mode = Column(String, nullable=True) # cash/upi/card/net_banking
    payment_status = Column(String, default="pending") # pending/paid/failed/refunded
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    clinic = relationship("Clinic")
    patient = relationship("Patient")
    appointment = relationship("Appointment")
    user = relationship("User")
    payments = relationship("Payment", back_populates="bill")

class Payment(BaseModel):
    __tablename__ = "payments"
    bill_id = Column(UUID(as_uuid=True), ForeignKey("bills.id"), nullable=False)
    amount = Column(Numeric, nullable=False)
    mode = Column(String, nullable=False)
    gateway_txn_id = Column(String, nullable=True)
    status = Column(String, nullable=False) # success/pending/failed
    paid_at = Column(DateTime(timezone=True), nullable=True)

    bill = relationship("Bill", back_populates="payments")
