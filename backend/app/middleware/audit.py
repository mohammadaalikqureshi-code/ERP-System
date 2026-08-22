from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
import uuid
from typing import Optional, Dict, Any

async def log_audit(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
    clinic_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None
):
    audit_entry = AuditLog(
        clinic_id=clinic_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address
    )
    db.add(audit_entry)
    # We rely on caller to commit
