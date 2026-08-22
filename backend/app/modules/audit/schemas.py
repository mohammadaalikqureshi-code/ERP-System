from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime

class AuditLogResponse(BaseModel):
    id: uuid.UUID
    clinic_id: Optional[uuid.UUID] = None
    user_id: uuid.UUID
    action: str
    entity_type: str
    entity_id: uuid.UUID
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    size: int

class AuditLogFilter(BaseModel):
    user_id: Optional[uuid.UUID] = None
    entity_type: Optional[str] = None
    action: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
