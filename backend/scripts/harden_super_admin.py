import asyncio
from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, Role
from app.models.audit import AuditLog

MASTER_EMAIL = "admin@medicare-erp.in"
MASTER_PASSWORD = "M3diC@re#2026!X9qV$RootKey"
MASTER_NAME = "Master Platform Administrator"

async def harden_super_admin():
    async with AsyncSessionLocal() as session:
        # 1. Fetch super_admin role
        sa_role = (await session.execute(select(Role).where(Role.name == "super_admin"))).scalar_one_or_none()
        if not sa_role:
            print("super_admin role not found.")
            return

        # 2. Fetch all users with super_admin role
        sa_users = (await session.execute(select(User).where(User.role_id == sa_role.id))).scalars().all()
        print(f"Found {len(sa_users)} super admin accounts.")

        master_user = None
        for u in sa_users:
            if u.email == MASTER_EMAIL:
                master_user = u
                break
        
        # If no user matches master email, pick the first one and re-assign
        if not master_user and sa_users:
            master_user = sa_users[0]
            master_user.email = MASTER_EMAIL

        if master_user:
            master_user.full_name = MASTER_NAME
            master_user.email = MASTER_EMAIL
            master_user.password_hash = get_password_hash(MASTER_PASSWORD)
            master_user.is_active = True
            master_user.clinic_id = None  # Global Platform Admin
            master_user.phone = "+91 99999 00000"
            print(f"Hardened master super admin: {master_user.email} (ID: {master_user.id})")

        # 3. Delete or reassign all other super_admin accounts
        deleted_count = 0
        for u in sa_users:
            if u.id != master_user.id:
                # Clean up any audit log references or nullify before deleting
                await session.execute(delete(AuditLog).where(AuditLog.user_id == u.id))
                await session.delete(u)
                deleted_count += 1

        # Also remove other duplicate test admin emails if any exist with different roles
        redundant_emails = ["admin@medicare.com", "superadmin@medicare.com", "superadmin@medicare-erp.in", "admin@gmail.com"]
        for email in redundant_emails:
            redundant_users = (await session.execute(select(User).where(User.email == email))).scalars().all()
            for ru in redundant_users:
                if ru.id != master_user.id:
                    await session.execute(delete(AuditLog).where(AuditLog.user_id == ru.id))
                    await session.delete(ru)
                    deleted_count += 1

        await session.commit()
        print(f"Purged {deleted_count} redundant super admin / test admin accounts.")

        # 4. Verification Check
        final_sa = (await session.execute(select(User).where(User.role_id == sa_role.id))).scalars().all()
        print(f"\n✅ Verification: Exactly {len(final_sa)} Super Admin account exists in the database:")
        for u in final_sa:
            print(f"- {u.full_name} | Email: {u.email} | Active: {u.is_active} | Clinic Scope: Global")

if __name__ == "__main__":
    asyncio.run(harden_super_admin())
