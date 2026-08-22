"""Panel management endpoints.

An administrator decides which parts of the product their clinic uses; the
frontend reads `/panels/enabled` to build its navigation.
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.middleware.clinic_scope import get_clinic_scope
from app.middleware.rbac import require_permission
from app.models.user import User
from app.modules.panels.schemas import EnabledModules, ModuleState, ModuleUpdate
from app.modules.panels.service import PanelService

router = APIRouter(prefix="/panels", tags=["Panel Management"])


@router.get("", response_model=List[ModuleState])
async def list_panels(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(require_permission("settings.read")),
):
    """Every available panel and whether this clinic has it switched on."""
    return await PanelService(db).list_modules(clinic_id)


@router.get("/enabled", response_model=EnabledModules)
async def enabled_panels(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(get_current_active_user),
):
    """The keys of the panels this clinic uses.

    Any signed-in user may call this — it drives their own navigation.
    """
    return EnabledModules(enabled=await PanelService(db).enabled_keys(clinic_id))


@router.patch("/{module_key}", response_model=ModuleState)
async def update_panel(
    module_key: str,
    payload: ModuleUpdate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(require_permission("settings.update")),
):
    """Switch a panel on or off, or change its options."""
    return await PanelService(db).update_module(clinic_id, module_key, payload, current_user.id)


@router.delete("/{module_key}", status_code=204)
async def reset_panel(
    module_key: str,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(require_permission("settings.update")),
):
    """Return a panel to its default state."""
    await PanelService(db).reset_module(clinic_id, module_key)
