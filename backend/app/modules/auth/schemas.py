import uuid
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    email_or_phone: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class UserProfile(BaseModel):
    id: Optional[uuid.UUID] = None
    full_name: Optional[str] = ""
    email: Optional[str] = None
    phone: Optional[str] = ""
    role: Optional[str] = "staff"
    role_name: Optional[str] = "staff"
    permissions: Optional[List[str]] = []
    clinic_id: Optional[uuid.UUID] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    profile: Optional[UserProfile] = None
    user: Optional[UserProfile] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OTPRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def normalise(cls, value: str) -> str:
        """Accept '+91 98765 43210' and store/compare it as '9876543210'."""
        digits = "".join(character for character in value if character.isdigit())
        if len(digits) < 10:
            raise ValueError("Enter a valid mobile number")
        return digits[-10:]


class OTPVerify(OTPRequest):
    otp: str = Field(..., min_length=4, max_length=8)


class OTPResponse(BaseModel):
    sent: bool
    expires_in: int
    message: str
    # Present in development only, so you can sign in without an SMS gateway.
    debug_code: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email_or_phone: str = Field(..., min_length=3)


class ForgotPasswordResponse(BaseModel):
    sent: bool = True
    message: str
    expires_in: int = 600
    debug_code: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    email_or_phone: str = Field(..., min_length=3)
    otp: str = Field(..., min_length=4, max_length=8)
    new_password: str = Field(..., min_length=6)

