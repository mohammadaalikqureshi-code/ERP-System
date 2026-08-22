from sqlalchemy import Column, String, ForeignKey, Integer, Numeric, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel, SoftDeleteMixin

class InventoryItem(BaseModel, SoftDeleteMixin):
    __tablename__ = "inventory_items"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False) # medicine, consumable, equipment
    stock_quantity = Column(Integer, default=0, nullable=False)
    unit_price = Column(Numeric, nullable=False)
    reorder_level = Column(Integer, default=10, nullable=False)
    expiry_date = Column(DateTime(timezone=True), nullable=True)

    clinic = relationship("Clinic")
    branch = relationship("Branch", back_populates="inventory_items")
    transactions = relationship("InventoryTransaction", back_populates="item")

class InventoryTransaction(BaseModel):
    __tablename__ = "inventory_transactions"
    item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    transaction_type = Column(String, nullable=False) # in, out, adjustment, return
    quantity = Column(Integer, nullable=False)
    remarks = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    item = relationship("InventoryItem", back_populates="transactions")
    user = relationship("User")
