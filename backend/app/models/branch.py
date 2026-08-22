from sqlalchemy import Column, String, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel, SoftDeleteMixin

class Branch(BaseModel, SoftDeleteMixin):
    __tablename__ = "branches"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=False)
    is_main_branch = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    clinic = relationship("Clinic", back_populates="branches")
    users = relationship("User", back_populates="branch")
    inventory_items = relationship("InventoryItem", back_populates="branch")
    appointments = relationship("Appointment", back_populates="branch")
