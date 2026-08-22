"""Admin endpoints for third-party API keys.

Secrets go in and never come back out: responses only ever carry a masked form.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.middleware.clinic_scope import get_clinic_scope
from app.middleware.rbac import require_permission
from app.models.user import User
from app.modules.ai.provider import AiRequestFailed, AiUnavailable, ClaudeProvider
from app.modules.api_keys.schemas import (
    ApiKeyCreate,
    ApiKeyListResponse,
    ApiKeyResponse,
    ApiKeyTestResult,
    ApiKeyUpdate,
)
from app.modules.api_keys.service import ApiKeyService

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


@router.get("", response_model=ApiKeyListResponse)
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(require_permission("settings.read")),
):
    """List configured keys (masked) plus the providers still missing one."""
    return await ApiKeyService(db).list_keys(clinic_id)


@router.post("", response_model=ApiKeyResponse, status_code=201)
async def save_api_key(
    payload: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(require_permission("settings.update")),
):
    """Add or replace the key for a provider."""
    return await ApiKeyService(db).upsert(clinic_id, current_user.id, payload)


@router.patch("/{key_id}", response_model=ApiKeyResponse)
async def update_api_key(
    key_id: uuid.UUID,
    payload: ApiKeyUpdate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(require_permission("settings.update")),
):
    """Rotate the secret, rename it, or switch it off without deleting it."""
    return await ApiKeyService(db).update(clinic_id, key_id, payload)


@router.delete("/{key_id}", status_code=204)
async def delete_api_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(require_permission("settings.update")),
):
    await ApiKeyService(db).delete(clinic_id, key_id)


@router.post("/{provider}/test", response_model=ApiKeyTestResult)
async def test_api_key(
    provider: str,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(require_permission("settings.update")),
):
    """Make a real call with the stored key so an admin knows it works.

    Right now only the AI provider can be verified live; the messaging
    providers report whether a key is present.
    """
    service = ApiKeyService(db)
    secret: Optional[str] = await service.resolve(provider, clinic_id)

    if not secret:
        return ApiKeyTestResult(provider=provider, ok=False, message="No key configured.")

    if provider != "anthropic":
        return ApiKeyTestResult(
            provider=provider,
            ok=True,
            message="Key stored. It will be verified the first time a message is sent.",
        )

    try:
        reply = await ClaudeProvider(secret).complete(
            system="Reply with the single word: ok",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=16,
        )
    except (AiUnavailable, AiRequestFailed) as exc:
        await service.record_usage(provider, clinic_id, error=str(exc))
        return ApiKeyTestResult(provider=provider, ok=False, message=str(exc))

    await service.record_usage(provider, clinic_id)
    return ApiKeyTestResult(
        provider=provider, ok=True, message=f"Working — answered using {reply.model}."
    )
