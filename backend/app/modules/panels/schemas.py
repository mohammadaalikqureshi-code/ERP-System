from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ModuleState(BaseModel):
    key: str
    label: str
    description: str
    is_enabled: bool
    is_default: bool = Field(
        ..., description="True when no explicit choice has been saved for this clinic"
    )
    roles: List[str] = []
    config: Dict[str, Any] = {}


class ModuleUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None


class EnabledModules(BaseModel):
    """The compact form the frontend uses to decide what to show in the nav."""

    enabled: List[str] = []
