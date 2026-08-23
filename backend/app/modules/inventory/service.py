from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.models.inventory import InventoryItem, InventoryTransaction, PurchaseOrder
from app.websockets.events import Events, build, room_for_clinic
from app.websockets.queue_manager import manager
from app.modules.inventory.schemas import InventoryItemCreate, InventoryItemUpdate, InventoryTransactionCreate
from app.core.exceptions import NotFoundError, ValidationError
import uuid
from typing import Optional
from datetime import datetime, timezone, timedelta
from decimal import Decimal


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

        # Expiry status
        expiry_status = None
        days_to_expiry = None
        if item.expiry_date:
            now = datetime.now(timezone.utc)
            delta = item.expiry_date - now
            days_to_expiry = delta.days
            if days_to_expiry < 0:
                expiry_status = "EXPIRED"
            elif days_to_expiry <= 30:
                expiry_status = "CRITICAL"
            elif days_to_expiry <= 60:
                expiry_status = "WARNING"
            elif days_to_expiry <= 90:
                expiry_status = "APPROACHING"
            else:
                expiry_status = "OK"

        return {
            "id": item.id,
            "clinic_id": item.clinic_id,
            "name": item.name,
            "type": item.type or "medicine",
            "category": item.category or category,
            "code": code,
            "unit": "Pcs",
            "stock_quantity": item.stock_quantity,
            "currentStock": item.stock_quantity,
            "unit_price": float(item.unit_price) if item.unit_price else 0.0,
            "unitPrice": float(item.unit_price) if item.unit_price else 0.0,
            "reorder_level": item.reorder_level,
            "minimumStock": item.reorder_level,
            "expiry_date": item.expiry_date,
            "expiryDate": str(item.expiry_date) if item.expiry_date else None,
            "expiryStatus": expiry_status,
            "daysToExpiry": days_to_expiry,
            # Batch tracking
            "batchNumber": item.batch_number,
            "manufactureDate": str(item.manufacture_date) if item.manufacture_date else None,
            "supplierName": item.supplier_name,
            "hsnCode": item.hsn_code,
            "genericName": item.generic_name,
            "prescriptionRequired": item.prescription_required,
            "manufacturer": item.supplier_name or "HealthCorp",
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
            item.stock_quantity = data.quantity
            
        self.db.add(txn)
        await self.db.commit()
        await self.db.refresh(txn)

        await manager.broadcast(
            room_for_clinic(clinic_id),
            build(Events.STOCK_CHANGED, item.id, stock=item.stock_quantity, name=item.name),
        )
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
        return [self._format_item(i) for i in items]

    async def list_expiring_items(self, clinic_id: uuid.UUID, days: int = 90):
        """Get medicines expiring within the specified number of days."""
        cutoff = datetime.now(timezone.utc) + timedelta(days=days)
        stmt = select(InventoryItem).where(
            InventoryItem.clinic_id == clinic_id,
            InventoryItem.is_deleted == False,
            InventoryItem.expiry_date.isnot(None),
            InventoryItem.expiry_date <= cutoff,
        ).order_by(InventoryItem.expiry_date)
        items = (await self.db.execute(stmt)).scalars().all()
        return [self._format_item(i) for i in items]

    async def generate_purchase_order(self, clinic_id: uuid.UUID, user_id: uuid.UUID, supplier_name: str = "Auto-Generated") -> dict:
        """Auto-generate a purchase order for all items below reorder level."""
        low_items = await self.list_low_stock(clinic_id)
        if not low_items:
            return {"message": "No items below reorder level", "items": []}

        # Generate PO number
        now = datetime.now(timezone.utc)
        prefix = f"PO-{now.strftime('%Y%m')}"
        count_stmt = select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.clinic_id == clinic_id,
            PurchaseOrder.po_number.like(f"{prefix}%")
        )
        count = (await self.db.execute(count_stmt)).scalar() or 0
        po_number = f"{prefix}-{count + 1:04d}"

        po_items = []
        total = Decimal("0")
        for item in low_items:
            qty_needed = max(item["minimumStock"] * 2 - item["currentStock"], item["minimumStock"])
            unit_price = Decimal(str(item["unitPrice"]))
            line_total = unit_price * qty_needed
            total += line_total
            po_items.append({
                "item_id": str(item["id"]),
                "name": item["name"],
                "current_stock": item["currentStock"],
                "reorder_level": item["minimumStock"],
                "quantity": qty_needed,
                "unit_price": float(unit_price),
                "total": float(line_total),
                "batch_number": item.get("batchNumber"),
                "hsn_code": item.get("hsnCode"),
            })

        po = PurchaseOrder(
            clinic_id=clinic_id,
            po_number=po_number,
            supplier_name=supplier_name,
            status="draft",
            items=po_items,
            total_amount=total,
            created_by=user_id,
        )
        self.db.add(po)
        await self.db.commit()
        await self.db.refresh(po)

        return {
            "id": str(po.id),
            "poNumber": po.po_number,
            "supplierName": po.supplier_name,
            "status": po.status,
            "items": po.items,
            "totalAmount": float(po.total_amount),
            "createdAt": str(po.created_at),
        }

    async def list_purchase_orders(self, clinic_id: uuid.UUID) -> list:
        stmt = select(PurchaseOrder).where(
            PurchaseOrder.clinic_id == clinic_id
        ).order_by(PurchaseOrder.created_at.desc())
        pos = (await self.db.execute(stmt)).scalars().all()
        return [
            {
                "id": str(po.id),
                "poNumber": po.po_number,
                "supplierName": po.supplier_name,
                "status": po.status,
                "items": po.items,
                "totalAmount": float(po.total_amount),
                "notes": po.notes,
                "createdAt": str(po.created_at),
            }
            for po in pos
        ]
