from sqlalchemy import Column, String, ForeignKey, Integer, Numeric, DateTime, Text, Boolean, JSON
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
    # Batch & Pharma tracking
    batch_number = Column(String, nullable=True)
    manufacture_date = Column(DateTime(timezone=True), nullable=True)
    supplier_name = Column(String, nullable=True)
    hsn_code = Column(String, nullable=True)
    category = Column(String, nullable=True)  # tablet, syrup, injection, consumable, equipment
    generic_name = Column(String, nullable=True)
    prescription_required = Column(Boolean, default=False)

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

class PurchaseOrder(BaseModel):
    __tablename__ = "purchase_orders"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    po_number = Column(String, nullable=False)
    supplier_name = Column(String, nullable=False)
    status = Column(String, default="draft")  # draft, sent, received, cancelled
    items = Column(JSON, nullable=False)
    total_amount = Column(Numeric, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    clinic = relationship("Clinic")
    user = relationship("User")
