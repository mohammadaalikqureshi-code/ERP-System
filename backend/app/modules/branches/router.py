from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.modules.branches.schemas import BranchCreate, BranchUpdate, BranchResponse
from app.modules.branches.service import BranchService
from app.middleware.rbac import require_permission
from app.core.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/branches", tags=["Branches"])

# SuperAdmin can do anything with branches. Admin can do most things (maybe limited to their clinic, which Service handles)
# The require_permission applies these rules.
require_admin = require_permission("clinics.create")

@router.post("", response_model=BranchResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_branch(
    data: BranchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = BranchService(db)
    # Ensure they create branch for their own clinic unless superadmin
    if current_user.role.name != "super_admin" and data.clinic_id != current_user.clinic_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Cannot create branch for another clinic")
    return await service.create_branch(data)


from app.middleware.clinic_scope import get_clinic_scope

@router.get("", response_model=List[BranchResponse])
async def list_branches(
    db: AsyncSession = Depends(get_db),
    clinic_id: UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    service = BranchService(db)
    if not clinic_id:
        return []
    return await service.list_branches(clinic_id)


@router.get("/{branch_id}", response_model=BranchResponse)
async def get_branch(
    branch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = BranchService(db)
    branch = await service.get_branch(branch_id)
    # Enforce clinic isolation
    if current_user.role.name != "super_admin" and branch.clinic_id != current_user.clinic_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")
    return branch


@router.patch("/{branch_id}", response_model=BranchResponse, dependencies=[Depends(require_admin)])
async def update_branch(
    branch_id: UUID,
    data: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = BranchService(db)
    branch = await service.get_branch(branch_id)
    if current_user.role.name != "super_admin" and branch.clinic_id != current_user.clinic_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")
    return await service.update_branch(branch_id, data)


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_branch(
    branch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = BranchService(db)
    branch = await service.get_branch(branch_id)
    if current_user.role.name != "super_admin" and branch.clinic_id != current_user.clinic_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")
    await service.delete_branch(branch_id)
