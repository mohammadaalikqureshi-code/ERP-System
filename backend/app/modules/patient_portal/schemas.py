from typing import List, Optional

from pydantic import BaseModel, UUID4, field_validator


def _normalise_mobile(value: str) -> str:
    digits = "".join(character for character in value if character.isdigit())
    if len(digits) < 10:
        raise ValueError("Enter a valid 10-digit mobile number")
    return digits[-10:]


class PatientLoginRequest(BaseModel):
    mobile: str

    @field_validator("mobile")
    @classmethod
    def normalise(cls, value: str) -> str:
        return _normalise_mobile(value)


class PatientLoginVerify(PatientLoginRequest):
    otp: str


class PatientOtpResponse(BaseModel):
    sent: bool
    expires_in: int
    message: str
    # Development only — lets you sign in without an SMS gateway.
    debug_code: Optional[str] = None


class PatientTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class PatientDashboardInfo(BaseModel):
    patient_id: UUID4
    patient_code: str
    full_name: str
    mobile: str
    upcoming_appointments: List[dict] = []
    recent_prescriptions: List[dict] = []
    lab_orders: List[dict] = []
