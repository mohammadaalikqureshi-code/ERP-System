from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from uuid import UUID

from app.models.branch import Branch
from app.modules.branches.schemas import BranchCreate, BranchUpdate

class BranchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_branch(self, data: BranchCreate) -> Branch:
        branch = Branch(**data.model_dump())
        self.db.add(branch)
        await self.db.commit()
        await self.db.refresh(branch)
        return branch

    async def list_branches(self, clinic_id: UUID) -> list[Branch]:
        stmt = select(Branch).where(Branch.clinic_id == clinic_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_branch(self, branch_id: UUID) -> Branch:
        stmt = select(Branch).where(Branch.id == branch_id)
        result = await self.db.execute(stmt)
        branch = result.scalar_one_or_none()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        return branch

    async def update_branch(self, branch_id: UUID, data: BranchUpdate) -> Branch:
        branch = await self.get_branch(branch_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(branch, key, value)
        await self.db.commit()
        await self.db.refresh(branch)
        return branch

    async def delete_branch(self, branch_id: UUID):
        branch = await self.get_branch(branch_id)
        await self.db.delete(branch)
        await self.db.commit()
