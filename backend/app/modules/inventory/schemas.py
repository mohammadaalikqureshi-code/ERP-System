from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class InventoryItemBase(BaseModel):
    name: str
    type: Optional[str] = "medicine"
    category: Optional[str] = "MEDICINE"
    code: Optional[str] = "MED-001"
    unit: Optional[str] = "Units"
    stock_quantity: int = 0
    currentStock: Optional[int] = 0
    unit_price: float = 0.0
    unitPrice: Optional[float] = 0.0
    reorder_level: int = 10
    minimumStock: Optional[int] = 10
    expiry_date: Optional[datetime] = None
    manufacturer: Optional[str] = ""
    notes: Optional[str] = ""

class InventoryItemCreate(BaseModel):
    name: str
    code: Optional[str] = ""
    category: Optional[str] = "MEDICINE"
    type: Optional[str] = "medicine"
    unit: Optional[str] = "Units"
    currentStock: Optional[int] = 0
    stock_quantity: Optional[int] = 0
    unitPrice: Optional[float] = 0.0
    unit_price: Optional[float] = 0.0
    minimumStock: Optional[int] = 10
    reorder_level: Optional[int] = 10
    manufacturer: Optional[str] = ""
    notes: Optional[str] = ""
    clinic_id: Optional[UUID] = None

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    type: Optional[str] = None
    unit: Optional[str] = None
    currentStock: Optional[int] = None
    stock_quantity: Optional[int] = None
    unitPrice: Optional[float] = None
    unit_price: Optional[float] = None
    minimumStock: Optional[int] = None
    reorder_level: Optional[int] = None
    expiry_date: Optional[datetime] = None
    manufacturer: Optional[str] = None
    notes: Optional[str] = None

class InventoryItemResponse(InventoryItemBase):
    id: UUID
    clinic_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_deleted: Optional[bool] = False
    model_config = ConfigDict(from_attributes=True)

class InventoryTransactionCreate(BaseModel):
    type: Optional[str] = "IN" # IN or OUT
    transaction_type: Optional[str] = "in"
    quantity: int = 1
    reference: Optional[str] = None
    remarks: Optional[str] = None
    notes: Optional[str] = None

class InventoryTransactionResponse(BaseModel):
    id: UUID
    item_id: UUID
    created_by: UUID
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class InventoryListResponse(BaseModel):
    items: List[InventoryItemResponse] = []
    data: List[InventoryItemResponse] = []
    total: int = 0
    page: int = 1
    size: int = 10
    pageSize: int = 10
    totalPages: int = 1
