import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class PatientBase(BaseModel):
    full_name: Optional[str] = None
    # The registration form collects the name in two boxes; either shape works.
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: str
    alt_mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    dob: Optional[date] = Field(None, validation_alias="date_of_birth")
    age: Optional[int] = Field(None, ge=0, le=130)
    gender: str
    blood_group: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    # Accepted for storage, encrypted immediately, never returned in full.
    aadhaar_number: Optional[str] = None
    allergies: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("mobile", "alt_mobile", "emergency_contact")
    @classmethod
    def normalise_mobile(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        digits = "".join(character for character in value if character.isdigit())
        if len(digits) < 10:
            raise ValueError("Enter a valid 10-digit mobile number")
        return digits[-10:]

    @field_validator("gender")
    @classmethod
    def normalise_gender(cls, value: str) -> str:
        allowed = {"male", "female", "other"}
        if value.lower() not in allowed:
            raise ValueError("Gender must be male, female or other")
        return value.lower()

    @field_validator("allergies", mode="before")
    @classmethod
    def join_allergies(cls, value):
        """The form sends a list; the record stores a readable string."""
        if isinstance(value, list):
            return ", ".join(str(item) for item in value if item) or None
        return value

    @model_validator(mode="after")
    def build_full_name(self):
        """Accept either `full_name` or `first_name` + `last_name`."""
        if not self.full_name:
            parts = [part for part in (self.first_name, self.last_name) if part]
            if not parts:
                raise ValueError("A patient name is required")
            self.full_name = " ".join(parts).strip()

        # Keep age and date of birth consistent with each other.
        if self.dob and self.age is None:
            today = date.today()
            self.age = (
                today.year
                - self.dob.year
                - ((today.month, today.day) < (self.dob.month, self.dob.day))
            )
        return self


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    """Every field optional — a PATCH only sends what changed."""

    model_config = ConfigDict(populate_by_name=True)

    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    alt_mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    dob: Optional[date] = Field(None, validation_alias="date_of_birth")
    age: Optional[int] = Field(None, ge=0, le=130)
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    aadhaar_number: Optional[str] = None
    allergies: Optional[str] = None


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_code: str
    full_name: str
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    mobile: str
    alt_mobile: Optional[str] = None
    email: Optional[EmailStr] = None
    dob: Optional[date] = None
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    gender: str
    blood_group: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    # Masked, e.g. "••••••••1234".
    aadhaar_number: Optional[str] = None
    allergies: Optional[str] = None
    created_at: Optional[datetime] = None


class PatientListResponse(BaseModel):
    items: List[PatientResponse] = []
    data: List[PatientResponse] = []
    total: int = 0
    page: int = 1
    size: int = 20
    pageSize: int = 20
    totalPages: int = 1
