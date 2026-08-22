from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.security import get_password_hash
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.models.user import User, Role

router = APIRouter(prefix="/users", tags=["Users"])

def format_staff(user: User) -> dict:
    name_parts = user.full_name.split(" ", 1) if user.full_name else ["", ""]
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    role_name = user.role.name.upper() if user.role else "STAFF"
    return {
        "id": str(user.id),
        "firstName": first_name,
        "lastName": last_name,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "role": role_name,
        "role_id": str(user.role_id),
        "isActive": user.is_active,
        "clinic_id": str(user.clinic_id) if user.clinic_id else None
    }

@router.get("/staff", dependencies=[Depends(require_permission("employees.read"))])
async def list_staff(
    role: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    stmt = select(User).options(selectinload(User.role)).where(
        (User.clinic_id == clinic_id) | (User.clinic_id == None)
    )
    if role and role != "ALL":
        stmt = stmt.join(Role).where(Role.name.ilike(f"%{role.lower()}%"))
        
    users = (await db.execute(stmt)).scalars().all()
    # Filter out patients
    staff_users = [u for u in users if u.role and u.role.name != "patient"]
    return [format_staff(u) for u in staff_users]

@router.post("/staff", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("employees.create"))])
async def create_staff(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    first_name = payload.get("firstName", "")
    last_name = payload.get("lastName", "")
    full_name = f"{first_name} {last_name}".strip() or "Staff Member"
    email = payload.get("email")
    phone = payload.get("phone", "")
    role_str = payload.get("role", "RECEPTIONIST").lower()

    stmt = select(Role).where(Role.name == role_str)
    role_obj = (await db.execute(stmt)).scalar_one_or_none()
    if not role_obj:
        stmt = select(Role).limit(1)
        role_obj = (await db.execute(stmt)).scalar_one()

    new_user = User(
        clinic_id=clinic_id,
        role_id=role_obj.id,
        full_name=full_name,
        email=email,
        phone=phone,
        password_hash=get_password_hash("Staff@123"),
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Reload with role
    stmt = select(User).options(selectinload(User.role)).where(User.id == new_user.id)
    reloaded = (await db.execute(stmt)).scalar_one()
    return format_staff(reloaded)

@router.put("/staff/{user_id}", dependencies=[Depends(require_permission("employees.update"))])
@router.patch("/staff/{user_id}", dependencies=[Depends(require_permission("employees.update"))])
async def update_staff(
    user_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).options(selectinload(User.role)).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    first_name = payload.get("firstName")
    last_name = payload.get("lastName")
    if first_name is not None or last_name is not None:
        user.full_name = f"{first_name or ''} {last_name or ''}".strip()
    if "email" in payload:
        user.email = payload["email"]
    if "phone" in payload:
        user.phone = payload["phone"]
    if "role" in payload:
        r_str = payload["role"].lower()
        stmt = select(Role).where(Role.name == r_str)
        r_obj = (await db.execute(stmt)).scalar_one_or_none()
        if r_obj:
            user.role_id = r_obj.id

    await db.commit()
    await db.refresh(user)
    return format_staff(user)

@router.patch("/staff/{user_id}/toggle-status", dependencies=[Depends(require_permission("employees.update"))])
async def toggle_staff_status(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).options(selectinload(User.role)).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = not user.is_active
    await db.commit()
    await db.refresh(user)
    return format_staff(user)
