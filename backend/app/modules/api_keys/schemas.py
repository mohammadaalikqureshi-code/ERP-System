from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Providers a clinic can hold a key for. Adding one here is all that is needed
# for it to appear in the admin UI.
SUPPORTED_PROVIDERS = {
    "anthropic": "AI assistant (Claude)",
    "whatsapp": "WhatsApp Business messaging",
    "msg91": "SMS delivery (MSG91)",
}


class ApiKeyCreate(BaseModel):
    provider: str = Field(..., description="One of: " + ", ".join(SUPPORTED_PROVIDERS))
    key: str = Field(..., min_length=8, description="The secret. Stored encrypted, never returned.")
    label: Optional[str] = Field(None, max_length=120, description="A note, e.g. 'Main clinic key'")

    @field_validator("provider")
    @classmethod
    def known_provider(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in SUPPORTED_PROVIDERS:
            raise ValueError(f"Unknown provider '{value}'. Supported: {', '.join(SUPPORTED_PROVIDERS)}")
        return value

    @field_validator("key")
    @classmethod
    def strip_key(cls, value: str) -> str:
        return value.strip()


class ApiKeyUpdate(BaseModel):
    key: Optional[str] = Field(None, min_length=8)
    label: Optional[str] = Field(None, max_length=120)
    is_active: Optional[bool] = None


class ApiKeyResponse(BaseModel):
    """What the API returns. Note there is no field holding the secret."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider: str
    description: Optional[str] = None
    label: Optional[str] = None
    masked_key: str
    is_active: bool
    last_used_at: Optional[datetime] = None
    last_error: Optional[str] = None
    usage_count: int = 0
    created_at: Optional[datetime] = None


class ApiKeyListResponse(BaseModel):
    items: List[ApiKeyResponse] = []
    # Providers with no key configured yet, so the UI can offer to add them.
    missing_providers: List[dict] = []


class ApiKeyTestResult(BaseModel):
    provider: str
    ok: bool
    message: str
