from pydantic import BaseModel, UUID4, Field
from typing import List, Optional
from datetime import datetime

class LabTestCatalogBase(BaseModel):
    test_name: str
    category: str
    price: float
    normal_range: Optional[str] = None

class LabTestCatalogCreate(LabTestCatalogBase):
    clinic_id: UUID4

class LabTestCatalogUpdate(LabTestCatalogBase):
    pass

class LabTestCatalogResponse(LabTestCatalogBase):
    id: UUID4
    clinic_id: UUID4
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LabResultBase(BaseModel):
    test_id: UUID4
    result_value: Optional[str] = None
    remarks: Optional[str] = None

class LabResultCreate(LabResultBase):
    pass

class LabResultResponse(LabResultBase):
    id: UUID4
    order_id: UUID4
    test: LabTestCatalogResponse
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LabOrderBase(BaseModel):
    status: str = "pending"

class LabOrderCreate(LabOrderBase):
    patient_id: UUID4
    doctor_id: UUID4
    appointment_id: Optional[UUID4] = None
    tests: List[UUID4] = Field(..., description="List of test IDs from catalog")

class LabOrderUpdate(BaseModel):
    status: str

class LabOrderResponse(LabOrderBase):
    id: UUID4
    patient_id: UUID4
    doctor_id: UUID4
    appointment_id: Optional[UUID4] = None
    results: List[LabResultResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
