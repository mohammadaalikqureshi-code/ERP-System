from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
from typing import Optional

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.models.user import User
from app.modules.billing.schemas import BillCreate, BillResponse, PaymentCreate, PaymentResponse, BillListResponse
from app.modules.billing.service import BillingService

router = APIRouter(prefix="/billing", tags=["Billing"])

@router.post("", response_model=BillResponse, dependencies=[Depends(require_permission("billing.create"))])
@router.post("/bills", response_model=BillResponse, dependencies=[Depends(require_permission("billing.create"))])
async def create_bill(
    data: BillCreate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(get_current_active_user)
):
    return await BillingService(db).create_bill(clinic_id, current_user.id, data)

@router.get("", response_model=BillListResponse, dependencies=[Depends(require_permission("billing.read"))])
@router.get("/bills", response_model=BillListResponse, dependencies=[Depends(require_permission("billing.read"))])
async def list_bills(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    pageSize: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    actual_size = pageSize if pageSize else size
    return await BillingService(db).list_bills(clinic_id, page, actual_size)

@router.get("/{id}", response_model=BillResponse, dependencies=[Depends(require_permission("billing.read"))])
@router.get("/bills/{id}", response_model=BillResponse, dependencies=[Depends(require_permission("billing.read"))])
async def get_bill(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await BillingService(db).get_bill(clinic_id, id)

@router.post("/{id}/pay", response_model=PaymentResponse, dependencies=[Depends(require_permission("billing.update"))])
@router.post("/bills/{id}/payments", response_model=PaymentResponse, dependencies=[Depends(require_permission("billing.update"))])
async def record_payment(
    id: uuid.UUID,
    data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    return await BillingService(db).record_payment(clinic_id, id, data)

@router.get("/{id}/receipt-pdf", dependencies=[Depends(require_permission("billing.read"))])
@router.get("/bills/{id}/pdf", dependencies=[Depends(require_permission("billing.read"))])
async def download_receipt(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope)
):
    pdf_bytes = await BillingService(db).generate_receipt_pdf(clinic_id, id)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=receipt_{id}.pdf"})
