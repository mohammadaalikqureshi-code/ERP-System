import uuid
from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator

VISIT_TYPES = {"new", "follow_up", "emergency"}
APPOINTMENT_STATUSES = {
    "booked",
    "checked_in",
    "in_consultation",
    "completed",
    "cancelled",
    "no_show",
    "skipped",
}


class AppointmentBase(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    # Filled in from the doctor's own department when the booking form omits it.
    department: Optional[str] = None
    visit_type: str = "new"
    appointment_date: date
    appointment_time: time
    notes: Optional[str] = None

    @field_validator("appointment_time", mode="before")
    @classmethod
    def parse_time(cls, v):
        if isinstance(v, str):
            parts = v.strip().split(":")
            if len(parts) >= 2:
                return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
        return v

    @field_validator("visit_type", mode="before")
    @classmethod
    def normalise_visit_type(cls, value):
        """Accept 'NEW', 'Follow_Up', 'follow-up' — store one canonical form."""
        if not value:
            return "new"
        cleaned = str(value).strip().lower().replace("-", "_").replace(" ", "_")
        if cleaned not in VISIT_TYPES:
            raise ValueError(f"Visit type must be one of: {', '.join(sorted(VISIT_TYPES))}")
        return cleaned


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    notes: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str

    @field_validator("status", mode="before")
    @classmethod
    def normalise_status(cls, value):
        cleaned = str(value).strip().lower()
        if cleaned not in APPOINTMENT_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(APPOINTMENT_STATUSES))}")
        return cleaned


class RescheduleRequest(BaseModel):
    appointment_date: date
    appointment_time: time


class PatientMiniResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    patient_code: Optional[str] = None
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    mobile: Optional[str] = None
    allergies: Optional[str] = None


class DoctorMiniResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    specialization: Optional[str] = None
    department: Optional[str] = None


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    department: Optional[str] = None
    visit_type: str
    appointment_date: date
    appointment_time: time
    notes: Optional[str] = None
    token_number: str
    queue_number: int
    status: str
    booked_by: uuid.UUID
    checked_in_at: Optional[datetime] = None
    consultation_started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    patient: Optional[PatientMiniResponse] = None
    doctor: Optional[DoctorMiniResponse] = None


class QueueResponse(BaseModel):
    current: Optional[dict] = None
    next: Optional[dict] = None
    waiting: List[dict] = []
    completed: List[dict] = []
    skipped: List[dict] = []


class QuickWalkinCreate(BaseModel):
    mobile: str
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = "male"
    blood_group: Optional[str] = "O+"
    doctor_id: uuid.UUID
    department: Optional[str] = None
    visit_type: str = "new"
    is_emergency: bool = False
    notes: Optional[str] = None
