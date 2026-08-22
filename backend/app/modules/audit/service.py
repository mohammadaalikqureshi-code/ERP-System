from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.audit import AuditLog
from app.modules.audit.schemas import AuditLogFilter
import uuid

class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_audit_logs(self, clinic_id: uuid.UUID, filters: AuditLogFilter, page: int = 1, size: int = 20):
        conditions = [AuditLog.clinic_id == clinic_id] if clinic_id else []
        
        if filters.user_id:
            conditions.append(AuditLog.user_id == filters.user_id)
        if filters.entity_type:
            conditions.append(AuditLog.entity_type == filters.entity_type)
        if filters.action:
            conditions.append(AuditLog.action == filters.action)
        if filters.start_date:
            conditions.append(AuditLog.created_at >= filters.start_date)
        if filters.end_date:
            conditions.append(AuditLog.created_at <= filters.end_date)
            
        stmt = select(AuditLog).where(and_(*conditions)).order_by(AuditLog.created_at.desc())
        
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar() or 0
        
        stmt = stmt.offset((page - 1) * size).limit(size)
        items = (await self.db.execute(stmt)).scalars().all()
        
        return {"items": items, "total": total, "page": page, "size": size}
