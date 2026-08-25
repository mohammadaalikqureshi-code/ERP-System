import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash, verify_password
from app.models.user import User

MASTER_PW = "M3diC@re#2026!X9qV$RootKey"

async def check():
    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.email == 'admin@medicare-erp.in'))).scalar_one_or_none()
        if user:
            print("Current DB Hash:", user.password_hash[:15], "...")
            # Set fresh hash
            user.password_hash = get_password_hash(MASTER_PW)
            await session.commit()
            print("Updated password hash with MASTER_PW.")
            print("Verify result:", verify_password(MASTER_PW, user.password_hash))

if __name__ == "__main__":
    asyncio.run(check())
