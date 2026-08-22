from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uuid
from decimal import Decimal
from datetime import datetime

class LineItem(BaseModel):
    item_id: Optional[uuid.UUID] = None
    description: str
    quantity: int = 1
    unitPrice: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    amount: Optional[Decimal] = None

class BillCreate(BaseModel):
    patientId: Optional[uuid.UUID] = None
    patient_id: Optional[uuid.UUID] = None
    appointmentId: Optional[uuid.UUID] = None
    appointment_id: Optional[uuid.UUID] = None
    bill_type: Optional[str] = "consultation"
    items: Optional[List[LineItem]] = None
    line_items: Optional[List[LineItem]] = None
    discount: Optional[Decimal] = Decimal('0')
    discount_amount: Optional[Decimal] = Decimal('0')
    paymentMode: Optional[str] = "CASH"
    payment_mode: Optional[str] = "CASH"

class BillResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    patientId: Optional[uuid.UUID] = None
    appointment_id: Optional[uuid.UUID] = None
    bill_number: str
    billNumber: Optional[str] = None
    bill_type: str
    line_items: List[Dict[str, Any]]
    items: Optional[List[Dict[str, Any]]] = None
    subtotal: Decimal
    discount_amount: Decimal
    discount: Optional[Decimal] = None
    gst_amount: Decimal
    total_amount: Decimal
    totalAmount: Optional[Decimal] = None
    payment_status: str
    status: Optional[str] = None
    patient: Optional[Dict[str, Any]] = None
    created_at: datetime
    createdAt: Optional[datetime] = None
    model_config = {"from_attributes": True}

class PaymentCreate(BaseModel):
    amount: Decimal
    mode: str = "cash"
    gateway_txn_id: Optional[str] = None

class PaymentResponse(BaseModel):
    id: uuid.UUID
    bill_id: uuid.UUID
    amount: Decimal
    mode: str
    status: str
    paid_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class BillListResponse(BaseModel):
    items: List[BillResponse] = []
    data: List[BillResponse] = []
    total: int = 0
    page: int = 1
    size: int = 10
    pageSize: int = 10
    totalPages: int = 1
