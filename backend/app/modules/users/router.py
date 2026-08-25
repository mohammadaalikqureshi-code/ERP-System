from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.security import get_password_hash
from app.core.exceptions import ForbiddenError, ValidationError
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.models.user import User, Role

router = APIRouter(prefix="/users", tags=["Users"])

ROLE_ALIASES = {
    "lab_technician": "lab_staff",
    "lab_tech": "lab_staff",
    "laboratory": "lab_staff",
    "lab": "lab_staff",
    "front_desk": "receptionist",
    "cashier": "receptionist",
    "pharmacy": "pharmacist",
    "hospital_admin": "clinic_admin",
}

def normalize_role_name(name: str) -> str:
    cleaned = (name or "").strip().lower()
    return ROLE_ALIASES.get(cleaned, cleaned)

def format_staff(user: User) -> dict:
    name_parts = user.full_name.split(" ", 1) if user.full_name else ["", ""]
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    role_name = user.role.name if user.role else "staff"
    return {
        "id": str(user.id),
        "firstName": first_name,
        "lastName": last_name,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "role": role_name,
        "role_id": str(user.role_id) if user.role_id else None,
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
        target_role = normalize_role_name(role)
        stmt = stmt.join(Role).where(Role.name.ilike(f"%{target_role}%"))
        
    users = (await db.execute(stmt)).scalars().all()
    # Filter out patients
    staff_users = [u for u in users if u.role and u.role.name != "patient"]
    return [format_staff(u) for u in staff_users]

@router.post("/staff", status_code=status.HTTP_201_CREATED)
async def create_staff(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user),
):
    # Strict Super Admin Authority Enforcement
    if not current_user.role or current_user.role.name != "super_admin":
        raise ForbiddenError("Only Platform Super Admin has the authority to provision staff accounts and issue login credentials.")

    first_name = (payload.get("firstName") or "").strip()
    last_name = (payload.get("lastName") or "").strip()
    full_name = f"{first_name} {last_name}".strip() or payload.get("full_name") or "Staff Member"
    email = payload.get("email", "").strip().lower()
    phone = payload.get("phone", "")
    raw_role = payload.get("role", "receptionist")
    role_str = normalize_role_name(raw_role)
    raw_password = payload.get("password") or "Staff@2026"

    # SINGLE SUPER ADMIN INVARIANT ENFORCEMENT
    if role_str == "super_admin":
        raise ForbiddenError("Security Invariant Violation: Only one Master Super Admin can exist. Additional super_admin creation is strictly prohibited.")

    # Check for existing email
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise ValidationError(f"A user account with email '{email}' already exists.")

    stmt = select(Role).where(Role.name == role_str)
    role_obj = (await db.execute(stmt)).scalar_one_or_none()
    if not role_obj:
        stmt = select(Role).where(Role.name.ilike(f"%{role_str}%"))
        role_obj = (await db.execute(stmt)).scalars().first()
        if not role_obj:
            raise ValidationError(f"Role '{raw_role}' is not valid on this system.")

    new_user = User(
        clinic_id=clinic_id,
        role_id=role_obj.id,
        full_name=full_name,
        email=email,
        phone=phone,
        password_hash=get_password_hash(raw_password),
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Reload with role
    stmt = select(User).options(selectinload(User.role)).where(User.id == new_user.id)
    reloaded = (await db.execute(stmt)).scalar_one()
    return format_staff(reloaded)

@router.put("/staff/{user_id}")
@router.patch("/staff/{user_id}")
async def update_staff(
    user_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not current_user.role or current_user.role.name != "super_admin":
        raise ForbiddenError("Only Super Admin has the authority to modify staff accounts and credentials.")

    stmt = select(User).options(selectinload(User.role)).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent demoting or altering the master super admin's role
    if user.role and user.role.name == "super_admin":
        if "role" in payload and normalize_role_name(payload["role"]) != "super_admin":
            raise ForbiddenError("Security Policy: The Master Super Admin cannot be demoted.")

    # Prevent elevating other users to super_admin
    if "role" in payload:
        r_str = normalize_role_name(payload["role"])
        if r_str == "super_admin" and user.role.name != "super_admin":
            raise ForbiddenError("Security Policy: Escalation to super_admin is strictly prohibited.")
        stmt = select(Role).where(Role.name == r_str)
        r_obj = (await db.execute(stmt)).scalar_one_or_none()
        if r_obj:
            user.role_id = r_obj.id

    first_name = payload.get("firstName")
    last_name = payload.get("lastName")
    if first_name is not None or last_name is not None:
        user.full_name = f"{first_name or ''} {last_name or ''}".strip()
    if "email" in payload:
        user.email = payload["email"].strip().lower()
    if "phone" in payload:
        user.phone = payload["phone"]
    if "password" in payload and payload["password"]:
        user.password_hash = get_password_hash(payload["password"])

    await db.commit()
    await db.refresh(user)
    return format_staff(user)

@router.patch("/staff/{user_id}/toggle-status")
async def toggle_staff_status(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not current_user.role or current_user.role.name != "super_admin":
        raise ForbiddenError("Only Super Admin has the authority to activate or suspend staff logins.")

    stmt = select(User).options(selectinload(User.role)).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # IMMUTABLE MASTER SUPER ADMIN GUARD
    if user.role and user.role.name == "super_admin":
        raise ForbiddenError("Security Policy: Master Super Admin cannot be deactivated.")
        
    user.is_active = not user.is_active
    await db.commit()
    await db.refresh(user)
    return format_staff(user)
