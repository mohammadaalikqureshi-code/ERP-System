from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AiStatus(BaseModel):
    available: bool
    reason: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[UUID] = None
    # Set when the conversation is about a specific patient, so the assistant
    # can answer with their record in front of it.
    patient_id: Optional[UUID] = None


class ChatResponse(BaseModel):
    conversation_id: UUID
    reply: str
    model: Optional[str] = None


class AiMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    content: str
    created_at: Optional[datetime] = None


class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: Optional[str] = None
    audience: str
    created_at: Optional[datetime] = None


class ConversationDetail(ConversationSummary):
    messages: List[AiMessageResponse] = []


class DraftMedicine(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    duration_days: str
    instructions: Optional[str] = None


class PrescriptionCheckRequest(BaseModel):
    patient_id: UUID
    medicines: List[DraftMedicine] = Field(..., min_length=1)


class InsightResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: str
    content: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    data: Optional[Dict[str, Any]] = None
    model: Optional[str] = None
    created_at: Optional[datetime] = None


class PrescriptionCheckResponse(BaseModel):
    id: UUID
    content: str
    has_critical: bool
    model: Optional[str] = None


class TriageRequest(BaseModel):
    note: str = Field(..., min_length=3, max_length=2000)


class TriageResponse(BaseModel):
    content: str
    model: Optional[str] = None


class DigestResponse(BaseModel):
    id: UUID
    content: str
    stats: Dict[str, Any]
    model: Optional[str] = None


class DigestRequest(BaseModel):
    on: Optional[date] = None
