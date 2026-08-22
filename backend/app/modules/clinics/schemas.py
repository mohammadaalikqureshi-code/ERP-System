from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
import uuid
from datetime import date
from decimal import Decimal

class ClinicBase(BaseModel):
    name: str
    address: str
    phone: str
    email: EmailStr
    gst_number: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    currency: str = "INR"
    language: str = "en"
    working_days: List[int] = Field(default=[1, 2, 3, 4, 5, 6])

class ClinicCreate(ClinicBase):
    pass

class ClinicUpdate(ClinicBase):
    is_active: Optional[bool] = None

class ClinicResponse(ClinicBase):
    id: uuid.UUID
    is_active: bool
    model_config = {"from_attributes": True}

class HolidayBase(BaseModel):
    date: date
    description: Optional[str] = None

class HolidayCreate(HolidayBase):
    pass

class HolidayResponse(HolidayBase):
    id: uuid.UUID
    clinic_id: uuid.UUID
    model_config = {"from_attributes": True}

class ClinicSettingsBase(BaseModel):
    gst_rate: Decimal = Field(default=18.0)
    session_timeout_minutes: int = Field(default=30)

class ClinicSettingsUpdate(ClinicSettingsBase):
    pass

class ClinicSettingsResponse(ClinicSettingsBase):
    clinic_id: uuid.UUID
    model_config = {"from_attributes": True}
