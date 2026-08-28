from typing import Optional
from fastapi import Depends, Query, Header
from app.core.deps import get_current_active_user
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.clinic import Clinic
import uuid

async def get_clinic_scope(
    clinic_id: Optional[str] = Query(None),
    x_clinic_id: Optional[str] = Header(None, alias="X-Clinic-ID"),
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> uuid.UUID:
    # 1. User has direct clinic_id
    if current_user.clinic_id is not None:
        return current_user.clinic_id

    # 2. X-Clinic-ID header
    target_id_str = x_clinic_id or clinic_id
    if target_id_str:
        try:
            return uuid.UUID(target_id_str)
        except ValueError:
            pass

    # 3. Fallback: Lookup primary active clinic from DB
    stmt = select(Clinic).where(Clinic.is_active == True).order_by(Clinic.created_at.asc()).limit(1)
    result = await db.execute(stmt)
    clinic = result.scalar_one_or_none()
    if clinic:
        return clinic.id

    # Fallback to any clinic
    stmt_any = select(Clinic).order_by(Clinic.created_at.asc()).limit(1)
    clinic_any = (await db.execute(stmt_any)).scalar_one_or_none()
    if clinic_any:
        return clinic_any.id

    return uuid.uuid4()
