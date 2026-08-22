from pydantic import BaseModel
from typing import Optional, List, Dict
import uuid
from datetime import datetime

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
