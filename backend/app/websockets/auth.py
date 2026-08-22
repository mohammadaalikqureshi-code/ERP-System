"""Authenticating a WebSocket connection.

A WebSocket cannot carry an Authorization header from the browser, so the
access token is passed as a query parameter and verified here — exactly the
same JWT the REST API uses. Without this, anyone who knew a clinic's id could
watch its live queue.
"""

import logging
import uuid
from dataclasses import dataclass
from typing import Optional

import jwt
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.user import User

logger = logging.getLogger(__name__)

# Close codes (RFC 6455 application range).
WS_UNAUTHORIZED = 4401
WS_FORBIDDEN = 4403


@dataclass
class SocketIdentity:
    user_id: uuid.UUID
    clinic_id: Optional[uuid.UUID]
    role: str


async def authenticate_socket(token: Optional[str]) -> Optional[SocketIdentity]:
    """Verify a token from the query string.

    Returns None when the token is missing, invalid, expired, or belongs to a
    user who is no longer active — the caller then closes the socket.
    """
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        logger.info("WebSocket rejected: token expired")
        return None
    except jwt.PyJWTError:
        logger.info("WebSocket rejected: invalid token")
        return None

    subject = payload.get("sub")
    if not subject:
        return None

    try:
        user_id = uuid.UUID(subject)
    except ValueError:
        return None

    # Confirm against the database: a token alone cannot prove the account is
    # still active or still belongs to the clinic it claims.
    async with AsyncSessionLocal() as db:
        user = (
            await db.execute(
                select(User).options(selectinload(User.role)).where(User.id == user_id)
            )
        ).scalar_one_or_none()

        if not user or user.is_deleted or not user.is_active:
            return None

        return SocketIdentity(
            user_id=user.id,
            clinic_id=user.clinic_id,
            role=user.role.name if user.role else "unknown",
        )


def may_watch_clinic(identity: SocketIdentity, requested_clinic_id: Optional[str]) -> bool:
    """Whether this user may subscribe to the requested clinic's updates.

    Staff belong to one clinic and may only watch that one. A super admin has
    no clinic of their own and may watch any.
    """
    if identity.role == "super_admin":
        return True
    if not identity.clinic_id:
        return False
    if not requested_clinic_id:
        return True
    return str(identity.clinic_id) == str(requested_clinic_id)
