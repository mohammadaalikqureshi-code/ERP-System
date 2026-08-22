from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.models.inventory import InventoryItem, InventoryTransaction
from app.websockets.events import Events, build, room_for_clinic
from app.websockets.queue_manager import manager
from app.modules.inventory.schemas import InventoryItemCreate, InventoryItemUpdate, InventoryTransactionCreate
from app.core.exceptions import NotFoundError, ValidationError
import uuid
from typing import Optional

class InventoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_item(self, data: InventoryItemCreate) -> InventoryItem:
        item = InventoryItem(**data.model_dump())
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def get_item(self, item_id: uuid.UUID, clinic_id: uuid.UUID) -> InventoryItem:
        stmt = select(InventoryItem).where(
            InventoryItem.id == item_id, 
            InventoryItem.clinic_id == clinic_id,
            InventoryItem.is_deleted == False
        )
        item = (await self.db.execute(stmt)).scalar_one_or_none()
        if not item:
            raise NotFoundError("Inventory item not found")
        return item

    async def update_item(self, item_id: uuid.UUID, clinic_id: uuid.UUID, data: InventoryItemUpdate) -> InventoryItem:
        item = await self.get_item(item_id, clinic_id)
        update_data = data.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(item, k, v)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def delete_item(self, item_id: uuid.UUID, clinic_id: uuid.UUID):
        item = await self.get_item(item_id, clinic_id)
        item.is_deleted = True
        await self.db.commit()

    def _format_item(self, item: InventoryItem) -> dict:
        cat_map = {
            "medicine": "MEDICINE",
            "consumable": "SUPPLY",
            "equipment": "EQUIPMENT"
        }
        category = cat_map.get(item.type.lower(), "MEDICINE") if item.type else "MEDICINE"
        code = f"MED-{str(item.id)[:4].upper()}"
        return {
            "id": item.id,
            "clinic_id": item.clinic_id,
            "name": item.name,
            "type": item.type or "medicine",
            "category": category,
            "code": code,
            "unit": "Pcs",
            "stock_quantity": item.stock_quantity,
            "currentStock": item.stock_quantity,
            "unit_price": float(item.unit_price) if item.unit_price else 0.0,
            "unitPrice": float(item.unit_price) if item.unit_price else 0.0,
            "reorder_level": item.reorder_level,
            "minimumStock": item.reorder_level,
            "expiry_date": item.expiry_date,
            "manufacturer": "HealthCorp",
            "notes": "",
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "is_deleted": item.is_deleted
        }

    async def list_items(self, clinic_id: uuid.UUID, page: int = 1, size: int = 20, search: Optional[str] = None):
        stmt = select(InventoryItem).where(
            InventoryItem.clinic_id == clinic_id,
            InventoryItem.is_deleted == False
        )
        if search:
            stmt = stmt.where(InventoryItem.name.ilike(f"%{search}%"))
        
        stmt = stmt.order_by(InventoryItem.name)
        
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar() or 0
        
        stmt = stmt.offset((page - 1) * size).limit(size)
        items = (await self.db.execute(stmt)).scalars().all()
        
        formatted = [self._format_item(i) for i in items]
        total_pages = max(1, (total + size - 1) // size)
        
        return {
            "items": formatted,
            "data": formatted,
            "total": total,
            "page": page,
            "size": size,
            "pageSize": size,
            "totalPages": total_pages
        }

    async def record_transaction(self, item_id: uuid.UUID, clinic_id: uuid.UUID, user_id: uuid.UUID, data: InventoryTransactionCreate) -> InventoryTransaction:
        item = await self.get_item(item_id, clinic_id)
        
        if data.transaction_type in ["out", "return"] and data.quantity > item.stock_quantity:
            raise ValidationError(f"Insufficient stock. Available: {item.stock_quantity}")
            
        txn = InventoryTransaction(
            item_id=item_id,
            transaction_type=data.transaction_type,
            quantity=data.quantity,
            remarks=data.remarks,
            created_by=user_id
        )
        
        if data.transaction_type == "in":
            item.stock_quantity += data.quantity
        elif data.transaction_type in ["out", "return"]:
            item.stock_quantity -= data.quantity
        elif data.transaction_type == "adjustment":
            # An adjustment is a stock-count correction: the quantity given is
            # the true figure on the shelf, not a delta.
            item.stock_quantity = data.quantity
            
        self.db.add(txn)
        await self.db.commit()
        await self.db.refresh(txn)

        await manager.broadcast(
            room_for_clinic(clinic_id),
            build(Events.STOCK_CHANGED, item.id, stock=item.stock_quantity, name=item.name),
        )
        # A separate event so the pharmacy screen can raise an alert without
        # having to compare thresholds itself.
        if item.stock_quantity <= item.reorder_level:
            await manager.broadcast(
                room_for_clinic(clinic_id),
                build(
                    Events.STOCK_LOW,
                    item.id,
                    name=item.name,
                    stock=item.stock_quantity,
                    reorder_level=item.reorder_level,
                ),
            )

        return txn

    async def list_low_stock(self, clinic_id: uuid.UUID):
        stmt = select(InventoryItem).where(
            InventoryItem.clinic_id == clinic_id,
            InventoryItem.is_deleted == False,
            InventoryItem.stock_quantity <= InventoryItem.reorder_level
        )
        items = (await self.db.execute(stmt)).scalars().all()
        return items
