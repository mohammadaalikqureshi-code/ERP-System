from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.models.user import User
from app.modules.inventory.schemas import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryListResponse,
    InventoryTransactionCreate,
    InventoryTransactionResponse
)
from app.modules.inventory.service import InventoryService

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("inventory.create"))])
async def create_item(
    data: InventoryItemCreate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    service = InventoryService(db)
    if not data.clinic_id:
        data.clinic_id = clinic_id
    return await service.create_item(data)

@router.get("", response_model=InventoryListResponse, dependencies=[Depends(require_permission("inventory.read"))])
async def list_items(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    pageSize: Optional[int] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    actual_size = pageSize if pageSize else size
    service = InventoryService(db)
    return await service.list_items(clinic_id, page, actual_size, search)

@router.get("/low-stock", response_model=List[InventoryItemResponse], dependencies=[Depends(require_permission("inventory.read"))])
async def list_low_stock(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    service = InventoryService(db)
    return await service.list_low_stock(clinic_id)

@router.get("/{item_id}", response_model=InventoryItemResponse, dependencies=[Depends(require_permission("inventory.read"))])
async def get_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    service = InventoryService(db)
    return await service.get_item(item_id, clinic_id)

@router.put("/{item_id}", response_model=InventoryItemResponse, dependencies=[Depends(require_permission("inventory.update"))])
@router.patch("/{item_id}", response_model=InventoryItemResponse, dependencies=[Depends(require_permission("inventory.update"))])
async def update_item(
    item_id: uuid.UUID,
    data: InventoryItemUpdate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    service = InventoryService(db)
    return await service.update_item(item_id, clinic_id, data)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("inventory.delete"))])
async def delete_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    service = InventoryService(db)
    await service.delete_item(item_id, clinic_id)

@router.post("/{item_id}/transactions", response_model=InventoryTransactionResponse, dependencies=[Depends(require_permission("inventory.update"))])
async def record_transaction(
    item_id: uuid.UUID,
    data: InventoryTransactionCreate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    service = InventoryService(db)
    return await service.record_transaction(item_id, clinic_id, current_user.id, data)
