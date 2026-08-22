"""Platform-level models: integration keys, panel toggles and AI conversations."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, SoftDeleteMixin


class ApiKey(BaseModel, SoftDeleteMixin):
    """A third-party credential owned by a clinic.

    The secret is stored encrypted (see `app.core.crypto`) and is never returned
    by the API — callers only ever see `masked_key`.
    """

    __tablename__ = "api_keys"
    __table_args__ = (UniqueConstraint("clinic_id", "provider", name="uq_api_key_clinic_provider"),)

    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    # e.g. "anthropic", "whatsapp", "msg91"
    provider = Column(String(50), nullable=False, index=True)
    label = Column(String(120), nullable=True)
    encrypted_key = Column(Text, nullable=False)
    masked_key = Column(String(120), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Usage tracking, so an admin can see whether a key is actually working.
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    usage_count = Column(Integer, default=0, nullable=False)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class ClinicModule(BaseModel):
    """Which panels/features a clinic has switched on.

    A missing row means "use the default for that module", so enabling a new
    module for everyone does not require a data migration.
    """

    __tablename__ = "clinic_modules"
    __table_args__ = (UniqueConstraint("clinic_id", "module_key", name="uq_clinic_module"),)

    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, index=True)
    module_key = Column(String(50), nullable=False, index=True)
    is_enabled = Column(Boolean, default=True, nullable=False)
    # Free-form per-module options, e.g. {"auto_summary": true}
    config = Column(JSON, nullable=False, default=dict)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class AiConversation(BaseModel):
    """One chat thread with the assistant."""

    __tablename__ = "ai_conversations"

    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True, index=True)
    title = Column(String(200), nullable=True)
    # Which assistant this thread is talking to: "staff" or "patient".
    audience = Column(String(20), nullable=False, default="staff")

    messages = relationship(
        "AiMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AiMessage.created_at",
    )


class AiMessage(BaseModel):
    """A single turn in an AI conversation."""

    __tablename__ = "ai_messages"

    conversation_id = Column(
        UUID(as_uuid=True), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    # Token counts, so a clinic can see what the assistant is costing.
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    model = Column(String(60), nullable=True)

    conversation = relationship("AiConversation", back_populates="messages")


class AiInsight(BaseModel):
    """Output of an automation run — a summary, safety check or digest.

    Stored so the doctor can see what the assistant produced earlier without
    paying to regenerate it, and so every AI output is auditable.
    """

    __tablename__ = "ai_insights"

    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False, index=True)
    # "consultation_summary" | "prescription_check" | "lab_interpretation" | "daily_digest"
    kind = Column(String(50), nullable=False, index=True)
    # The record this insight is about (appointment, prescription, lab order...).
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    content = Column(Text, nullable=False)
    # Anything structured the automation produced, e.g. a list of interactions.
    data = Column(JSON, nullable=True)
    model = Column(String(60), nullable=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
