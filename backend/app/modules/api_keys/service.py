"""Storage and lookup of third-party API keys.

Keys are encrypted at rest and never leave the backend: the admin UI only ever
sees a masked form (`sk-ant-••••••••3f2a`). Internal callers ask
`resolve(provider, clinic_id)` for the plaintext when they need to make a call.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import encrypt, mask, try_decrypt
from app.core.exceptions import NotFoundError
from app.models.system import ApiKey
from app.modules.api_keys.schemas import SUPPORTED_PROVIDERS, ApiKeyCreate, ApiKeyUpdate

logger = logging.getLogger(__name__)

# Environment variables used as a platform-wide fallback when a clinic has not
# stored its own key. Lets a single-tenant deployment configure everything with
# env vars and never touch the admin screen.
ENV_FALLBACKS = {
    "anthropic": "AI_API_KEY",
    "whatsapp": "WHATSAPP_API_TOKEN",
    "msg91": "MSG91_API_KEY",
}


class ApiKeyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_keys(self, clinic_id: Optional[UUID]) -> dict:
        statement = (
            select(ApiKey)
            .where(ApiKey.clinic_id == clinic_id, ApiKey.is_deleted == False)  # noqa: E712
            .order_by(ApiKey.provider)
        )
        keys = list((await self.db.execute(statement)).scalars().all())

        configured = {key.provider for key in keys}
        for key in keys:
            key.description = SUPPORTED_PROVIDERS.get(key.provider)

        return {
            "items": keys,
            "missing_providers": [
                {"provider": provider, "description": description}
                for provider, description in SUPPORTED_PROVIDERS.items()
                if provider not in configured
            ],
        }

    async def upsert(self, clinic_id: Optional[UUID], user_id: UUID, data: ApiKeyCreate) -> ApiKey:
        """Store a key, replacing any existing key for the same provider.

        One key per provider per clinic keeps the mental model simple: there is
        never a question of which key is in use.
        """
        existing = await self._find(clinic_id, data.provider, include_deleted=True)

        if existing:
            existing.encrypted_key = encrypt(data.key)
            existing.masked_key = mask(data.key, visible=4)
            existing.label = data.label
            existing.is_active = True
            existing.is_deleted = False
            existing.last_error = None
            record = existing
        else:
            record = ApiKey(
                clinic_id=clinic_id,
                provider=data.provider,
                label=data.label,
                encrypted_key=encrypt(data.key),
                masked_key=mask(data.key, visible=4),
                created_by=user_id,
            )
            self.db.add(record)

        await self.db.commit()
        await self.db.refresh(record)
        record.description = SUPPORTED_PROVIDERS.get(record.provider)
        return record

    async def update(self, clinic_id: Optional[UUID], key_id: UUID, data: ApiKeyUpdate) -> ApiKey:
        record = await self._get(clinic_id, key_id)

        if data.key:
            record.encrypted_key = encrypt(data.key.strip())
            record.masked_key = mask(data.key.strip(), visible=4)
            record.last_error = None
        if data.label is not None:
            record.label = data.label
        if data.is_active is not None:
            record.is_active = data.is_active

        await self.db.commit()
        await self.db.refresh(record)
        record.description = SUPPORTED_PROVIDERS.get(record.provider)
        return record

    async def delete(self, clinic_id: Optional[UUID], key_id: UUID) -> None:
        record = await self._get(clinic_id, key_id)
        record.is_deleted = True
        record.is_active = False
        await self.db.commit()

    async def resolve(self, provider: str, clinic_id: Optional[UUID]) -> Optional[str]:
        """Return the usable secret for a provider, or None if none is set.

        Resolution order: the clinic's own key, then the platform-wide key from
        the environment.
        """
        record = await self._find(clinic_id, provider)
        if record and record.is_active:
            secret = try_decrypt(record.encrypted_key)
            if secret:
                return secret
            logger.error(
                "Stored %s key for clinic %s could not be decrypted", provider, clinic_id
            )

        env_name = ENV_FALLBACKS.get(provider)
        return getattr(settings, env_name, "") or None if env_name else None

    async def record_usage(self, provider: str, clinic_id: Optional[UUID], error: Optional[str] = None) -> None:
        """Note that a key was used, and remember the last failure if any.

        This is what makes the admin screen able to say "working" or "failing"
        rather than just "configured".
        """
        record = await self._find(clinic_id, provider)
        if not record:
            return

        record.usage_count = (record.usage_count or 0) + 1
        record.last_used_at = datetime.now(timezone.utc)
        record.last_error = error[:500] if error else None
        await self.db.commit()

    # ------------------------------------------------------------- internals
    async def _find(
        self, clinic_id: Optional[UUID], provider: str, include_deleted: bool = False
    ) -> Optional[ApiKey]:
        statement = select(ApiKey).where(
            ApiKey.clinic_id == clinic_id, ApiKey.provider == provider
        )
        if not include_deleted:
            statement = statement.where(ApiKey.is_deleted == False)  # noqa: E712
        return (await self.db.execute(statement)).scalar_one_or_none()

    async def _get(self, clinic_id: Optional[UUID], key_id: UUID) -> ApiKey:
        statement = select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.clinic_id == clinic_id,
            ApiKey.is_deleted == False,  # noqa: E712
        )
        record = (await self.db.execute(statement)).scalar_one_or_none()
        if not record:
            raise NotFoundError("API key not found")
        return record
