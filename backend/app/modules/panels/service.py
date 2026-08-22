"""Per-clinic panel management.

A clinic's choices are stored as overrides: a row exists only for a module
whose state was deliberately changed. Everything else follows the catalogue
default, so shipping a new module does not need a data migration.
"""

from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_invalidate, cached
from app.core.exceptions import NotFoundError
from app.models.system import ClinicModule
from app.modules.panels.catalog import MODULE_CATALOG, MODULES_BY_KEY
from app.modules.panels.schemas import ModuleUpdate


class PanelService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _overrides(self, clinic_id: UUID) -> Dict[str, ClinicModule]:
        rows = (
            await self.db.execute(select(ClinicModule).where(ClinicModule.clinic_id == clinic_id))
        ).scalars()
        return {row.module_key: row for row in rows}

    async def list_modules(self, clinic_id: UUID) -> List[dict]:
        """Every module in the catalogue with this clinic's effective state."""
        overrides = await self._overrides(clinic_id)

        result = []
        for module in MODULE_CATALOG:
            override = overrides.get(module.key)
            result.append(
                {
                    "key": module.key,
                    "label": module.label,
                    "description": module.description,
                    "is_enabled": override.is_enabled if override else module.default_enabled,
                    "is_default": override is None,
                    "roles": list(module.roles),
                    "config": (override.config if override else {}) or {},
                }
            )
        return result

    async def enabled_keys(self, clinic_id: UUID) -> List[str]:
        """Just the enabled module keys. Cached — the frontend asks on every load."""

        async def load() -> List[str]:
            modules = await self.list_modules(clinic_id)
            return [module["key"] for module in modules if module["is_enabled"]]

        return await cached(f"panels:{clinic_id}", loader=load, ttl=300)

    async def is_enabled(self, clinic_id: UUID, module_key: str) -> bool:
        return module_key in await self.enabled_keys(clinic_id)

    async def update_module(
        self, clinic_id: UUID, module_key: str, data: ModuleUpdate, user_id: Optional[UUID] = None
    ) -> dict:
        definition = MODULES_BY_KEY.get(module_key)
        if not definition:
            raise NotFoundError(f"Unknown module '{module_key}'")

        existing = (
            await self.db.execute(
                select(ClinicModule).where(
                    ClinicModule.clinic_id == clinic_id, ClinicModule.module_key == module_key
                )
            )
        ).scalar_one_or_none()

        if not existing:
            existing = ClinicModule(
                clinic_id=clinic_id,
                module_key=module_key,
                is_enabled=definition.default_enabled,
                config={},
            )
            self.db.add(existing)

        if data.is_enabled is not None:
            existing.is_enabled = data.is_enabled
        if data.config is not None:
            existing.config = data.config
        existing.updated_by = user_id

        await self.db.commit()
        await self.db.refresh(existing)
        await cache_invalidate(f"panels:{clinic_id}")

        return {
            "key": definition.key,
            "label": definition.label,
            "description": definition.description,
            "is_enabled": existing.is_enabled,
            "is_default": False,
            "roles": list(definition.roles),
            "config": existing.config or {},
        }

    async def reset_module(self, clinic_id: UUID, module_key: str) -> None:
        """Drop the override so the module follows the catalogue default again."""
        existing = (
            await self.db.execute(
                select(ClinicModule).where(
                    ClinicModule.clinic_id == clinic_id, ClinicModule.module_key == module_key
                )
            )
        ).scalar_one_or_none()

        if existing:
            await self.db.delete(existing)
            await self.db.commit()
            await cache_invalidate(f"panels:{clinic_id}")
