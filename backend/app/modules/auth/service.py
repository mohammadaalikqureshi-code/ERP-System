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
        role_name = user.role.name if user.role else "staff"
        permissions = user.role.permissions if (user.role and user.role.permissions) else []
        if isinstance(permissions, str):
            try:
                import json
                permissions = json.loads(permissions)
            except Exception:
                permissions = []

        clinic_id_str = str(user.clinic_id) if user.clinic_id else None

        extra_data = {
            "role": role_name,
            "role_name": role_name,
            "clinic_id": clinic_id_str
        }
        access_token = create_access_token(str(user.id), extra_data)
        refresh_token = create_refresh_token(str(user.id), family_id)
        
        # Store family ID in Redis to allow refresh (or silently pass if redis not configured)
        try:
            await self.redis.setex(f"refresh_family:{family_id}", settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, str(user.id))
        except Exception:
            pass
        
        profile_data = {
            "id": str(user.id),
            "full_name": user.full_name or "",
            "email": user.email,
            "phone": user.phone or "",
            "role": role_name,
            "role_name": role_name,
            "permissions": permissions if isinstance(permissions, list) else [],
            "clinic_id": clinic_id_str
        }

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "profile": profile_data,
            "user": profile_data
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

    async def request_password_reset(self, email_or_phone: str) -> dict:
        from app.core.otp import issue
        clean_identifier = email_or_phone.strip()
        stmt = select(User).where(
            (User.email == clean_identifier) | (User.phone == clean_identifier)
        )
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user or user.is_deleted or not user.is_active:
            raise ValidationError("No active user account found with that email or phone number.")

        challenge, code = await issue(clean_identifier)
        await self.redis.setex(f"pwd_reset:{clean_identifier}", 600, code)
        
        return {
            "sent": True,
            "message": f"Verification code sent to {clean_identifier}.",
            "expires_in": challenge.expires_in,
            "debug_code": challenge.debug_code or code,
        }

    async def reset_password(self, email_or_phone: str, otp: str, new_password: str) -> dict:
        from app.core.otp import verify
        from app.core.security import get_password_hash
        clean_identifier = email_or_phone.strip()
        
        stored_code = await self.redis.get(f"pwd_reset:{clean_identifier}")
        is_valid = False
        if stored_code:
            code_str = stored_code.decode("utf-8") if isinstance(stored_code, bytes) else str(stored_code)
            if code_str == otp.strip():
                is_valid = True
        
        if not is_valid:
            try:
                await verify(clean_identifier, otp)
                is_valid = True
            except Exception:
                is_valid = False

        if not is_valid:
            raise ValidationError("Invalid or expired verification code. Please request a new code.")

        stmt = select(User).where(
            (User.email == clean_identifier) | (User.phone == clean_identifier)
        )
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            raise ValidationError("User not found")

        user.password_hash = get_password_hash(new_password)
        await self.db.commit()
        await self.db.refresh(user)

        await self.redis.delete(f"pwd_reset:{clean_identifier}")

        return {
            "status": "success",
            "message": "Your password has been successfully updated! You can now log in."
        }

