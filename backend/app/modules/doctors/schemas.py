from pydantic import BaseModel, EmailStr
from typing import Optional, List
import uuid
from datetime import date, time
from decimal import Decimal

class DoctorBase(BaseModel):
    specialization: str
    department: str
    qualification: str
    consultation_fee: Decimal
    avg_consultation_minutes: int = 15
    signature_url: Optional[str] = None
    is_available: bool = True

class DoctorCreate(DoctorBase):
    user_id: uuid.UUID

class DoctorUpdate(DoctorBase):
    pass

class DoctorResponse(DoctorBase):
    id: uuid.UUID
    clinic_id: uuid.UUID
    user_id: uuid.UUID
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    isActive: Optional[bool] = True
    model_config = {"from_attributes": True}

class ScheduleBase(BaseModel):
    day_of_week: int
    start_time: time
    end_time: time
    slot_duration_minutes: int = 15
    break_start: Optional[time] = None
    break_end: Optional[time] = None

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleResponse(ScheduleBase):
    id: uuid.UUID
    doctor_id: uuid.UUID
    model_config = {"from_attributes": True}

class LeaveBase(BaseModel):
    date_from: date
    date_to: date
    reason: Optional[str] = None

class LeaveCreate(LeaveBase):
    pass

class LeaveResponse(LeaveBase):
    id: uuid.UUID
    doctor_id: uuid.UUID
    is_approved: bool
    model_config = {"from_attributes": True}

class AvailableSlot(BaseModel):
    # "09:20" — what the slot picker shows and sends back when booking.
    time: str
    start_time: time
    end_time: time
    # False when the slot is already taken; the picker greys these out.
    is_available: bool = True

class AvailableSlotsResponse(BaseModel):
    date: date
    slots: List[AvailableSlot]
