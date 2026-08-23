from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import uuid
from datetime import datetime


class AppNotificationResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    sender_user_id: Optional[uuid.UUID] = None
    sender_name: str
    target_role: str
    target_user_id: Optional[uuid.UUID] = None
    target_doctor_id: Optional[uuid.UUID] = None
    category: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class AppNotificationInboxResponse(BaseModel):
    items: List[AppNotificationResponse]
    unread_count: int
    total: int


class SendNotificationRequest(BaseModel):
    target_role: str = Field(default="all", description="Target role: doctor, receptionist, lab_staff, pharmacist, clinic_admin, nurse, all")
    target_user_id: Optional[uuid.UUID] = None
    target_doctor_id: Optional[uuid.UUID] = None
    category: str = Field(default="general", description="appointment, clinical, lab, pharmacy, billing, urgent, general")
    title: str
    message: str
    link: Optional[str] = None


class NotificationResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: Optional[uuid.UUID] = None
    recipient_phone: str
    channel: str
    template_code: str
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    page: int
    size: int

