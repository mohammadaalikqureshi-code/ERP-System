from fastapi import Depends
from app.core.deps import get_current_active_user
from app.core.exceptions import ForbiddenError

def require_permission(permission: str):
    async def checker(current_user = Depends(get_current_active_user)):
        role = current_user.role
        if permission not in role.permissions:
            raise ForbiddenError(f"Permission '{permission}' required")
        return current_user
    return checker
