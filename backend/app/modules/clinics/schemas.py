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
    # Branding
    tagline: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    header_image_url: Optional[str] = None
    footer_text: Optional[str] = None
    registration_number: Optional[str] = None
    drug_license_number: Optional[str] = None

class ClinicResponse(ClinicBase):
    id: uuid.UUID
    is_active: bool
    tagline: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    header_image_url: Optional[str] = None
    footer_text: Optional[str] = None
    registration_number: Optional[str] = None
    drug_license_number: Optional[str] = None
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
    # Split GST
    cgst_rate: Optional[Decimal] = Field(default=9.0)
    sgst_rate: Optional[Decimal] = Field(default=9.0)
    # Payment gateway
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    # SMS
    sms_provider: Optional[str] = None
    sms_api_key: Optional[str] = None
    sms_sender_id: Optional[str] = None
    whatsapp_enabled: Optional[bool] = False
    auto_sms_appointment: Optional[bool] = True
    auto_sms_prescription: Optional[bool] = True
    auto_sms_lab_report: Optional[bool] = True
    # TTS
    tts_enabled: Optional[bool] = True
    tts_language: Optional[str] = "en-IN"

class ClinicSettingsUpdate(ClinicSettingsBase):
    pass

class ClinicSettingsResponse(ClinicSettingsBase):
    clinic_id: uuid.UUID
    model_config = {"from_attributes": True}
