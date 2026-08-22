from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

class BranchBase(BaseModel):
    clinic_id: UUID
    name: str
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    is_main_branch: Optional[bool] = False
    is_active: Optional[bool] = True

class BranchCreate(BranchBase):
    pass

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_main_branch: Optional[bool] = None
    is_active: Optional[bool] = None

class BranchResponse(BranchBase):
    id: UUID

    class Config:
        from_attributes = True
