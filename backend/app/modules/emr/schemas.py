from pydantic import BaseModel, UUID4, Field
from typing import List, Optional
from datetime import date, datetime

class VitalsBase(BaseModel):
    blood_pressure: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    temperature: Optional[float] = None
    notes: Optional[str] = None

class VitalsCreate(VitalsBase):
    appointment_id: UUID4

class VitalsUpdate(VitalsBase):
    pass

class VitalsResponse(VitalsBase):
    id: UUID4
    appointment_id: UUID4
    bmi: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MedicalHistoryBase(BaseModel):
    condition: str
    diagnosed_date: Optional[date] = None
    status: str
    notes: Optional[str] = None

class MedicalHistoryCreate(MedicalHistoryBase):
    patient_id: UUID4

class MedicalHistoryUpdate(MedicalHistoryBase):
    pass

class MedicalHistoryResponse(MedicalHistoryBase):
    id: UUID4
    patient_id: UUID4
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PrescriptionItemBase(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    duration_days: str
    instructions: Optional[str] = None

class PrescriptionItemCreate(PrescriptionItemBase):
    pass

class PrescriptionItemResponse(PrescriptionItemBase):
    id: UUID4
    prescription_id: UUID4
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PrescriptionBase(BaseModel):
    notes: Optional[str] = None

class PrescriptionCreate(PrescriptionBase):
    appointment_id: UUID4
    patient_id: UUID4
    doctor_id: UUID4
    items: List[PrescriptionItemCreate]

class PrescriptionResponse(PrescriptionBase):
    id: UUID4
    appointment_id: UUID4
    patient_id: UUID4
    doctor_id: UUID4
    items: List[PrescriptionItemResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EMRTemplateBase(BaseModel):
    clinic_id: UUID4
    name: str
    specialty: Optional[str] = None
    form_schema: str
    is_active: Optional[bool] = True

class EMRTemplateCreate(EMRTemplateBase):
    pass

class EMRTemplateUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    form_schema: Optional[str] = None
    is_active: Optional[bool] = None

class EMRTemplateResponse(EMRTemplateBase):
    id: UUID4
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
