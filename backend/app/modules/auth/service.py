from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.user import User
from app.core.security import verify_password, create_access_token, create_refresh_token
from app.core.exceptions import ValidationError, ForbiddenError, UnauthorizedError
from redis.asyncio import Redis
import uuid
import jwt
from app.core.config import settings

class AuthService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def authenticate(self, email_or_phone: str, password: str) -> User:
        clean_identifier = email_or_phone.strip()
        stmt = select(User).options(selectinload(User.role)).where(
            (User.email == clean_identifier) | (User.phone == clean_identifier)
        )
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user or user.is_deleted or not user.is_active:
            raise UnauthorizedError("Invalid credentials")
            
        if not verify_password(password, user.password_hash):
            raise UnauthorizedError("Invalid credentials")
            
        return user

    async def generate_tokens(self, user: User) -> dict:
        family_id = str(uuid.uuid4())
        extra_data = {
            "role": user.role.name,
            "role_name": user.role.name,
            "clinic_id": str(user.clinic_id) if user.clinic_id else None
        }
        access_token = create_access_token(str(user.id), extra_data)
        refresh_token = create_refresh_token(str(user.id), family_id)
        
        # Store family ID in Redis to allow refresh
        await self.redis.setex(f"refresh_family:{family_id}", settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, str(user.id))
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "profile": {
                "id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.phone,
                "role": user.role.name,
                "role_name": user.role.name,
                "permissions": user.role.permissions,
                "clinic_id": str(user.clinic_id) if user.clinic_id else None
            }
        }

    async def refresh_token(self, token: str) -> dict:
        try:
            payload = jwt.decode(token, settings.JWT_REFRESH_SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("sub")
            family_id = payload.get("family_id")
            
            stored_user_id = await self.redis.get(f"refresh_family:{family_id}")
            if stored_user_id != user_id:
                # Reuse detected or revoked
                await self.redis.delete(f"refresh_family:{family_id}")
                raise ForbiddenError("Invalid refresh token")
                
            stmt = select(User).options(selectinload(User.role)).where(User.id == uuid.UUID(user_id))
            result = await self.db.execute(stmt)
            user = result.scalar_one_or_none()
            if not user or not user.is_active:
                raise ForbiddenError("User inactive")
                
            # Rotate
            await self.redis.delete(f"refresh_family:{family_id}")
            return await self.generate_tokens(user)
            
        except jwt.PyJWTError:
            raise ForbiddenError("Invalid refresh token")
            
    async def logout(self, token: str):
        try:
            payload = jwt.decode(token, settings.JWT_REFRESH_SECRET_KEY, algorithms=["HS256"], options={"verify_signature": False})
            family_id = payload.get("family_id")
            if family_id:
                await self.redis.delete(f"refresh_family:{family_id}")
        except jwt.PyJWTError:
            pass
