from fastapi import APIRouter, Depends, Response, HTTPException, status, Body
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional

from app.core.database import get_db
from app.middleware.rbac import require_permission
from app.middleware.clinic_scope import get_clinic_scope
from app.modules.lab.schemas import LabTestCatalogCreate, LabTestCatalogUpdate, LabOrderCreate, LabOrderUpdate
from app.modules.lab.service import LabService
from app.modules.lab.pdf_generator import LabReportPDFGenerator

router = APIRouter(prefix="/lab", tags=["Lab"])

# Catalog Endpoints
@router.post("/catalog", dependencies=[Depends(require_permission("lab.create"))])
async def create_catalog_test(
    test_data: LabTestCatalogCreate, 
    db: AsyncSession = Depends(get_db),
    clinic_id: UUID = Depends(get_clinic_scope)
):
    if not test_data.clinic_id:
        test_data.clinic_id = clinic_id
    return await LabService.create_test(db, test_data)

@router.get("/catalog", dependencies=[Depends(require_permission("lab.read"))])
async def get_catalog(
    db: AsyncSession = Depends(get_db),
    clinic_id: UUID = Depends(get_clinic_scope)
):
    return await LabService.get_all_tests(db, clinic_id)

@router.get("/catalog/clinic/{clinic_id}", dependencies=[Depends(require_permission("lab.read"))])
async def get_clinic_catalog(clinic_id: UUID, db: AsyncSession = Depends(get_db)):
    return await LabService.get_all_tests(db, clinic_id)

@router.get("/catalog/{test_id}", dependencies=[Depends(require_permission("lab.read"))])
async def get_test(test_id: UUID, db: AsyncSession = Depends(get_db)):
    return await LabService.get_test(db, test_id)

@router.put("/catalog/{test_id}", dependencies=[Depends(require_permission("lab.update"))])
async def update_test(test_id: UUID, test_data: LabTestCatalogUpdate, db: AsyncSession = Depends(get_db)):
    return await LabService.update_test(db, test_id, test_data)

# Order Endpoints
@router.get("/orders", dependencies=[Depends(require_permission("lab.read"))])
async def list_orders(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    clinic_id: UUID = Depends(get_clinic_scope)
):
    return await LabService.get_all_orders(db, clinic_id)

@router.post("/orders", dependencies=[Depends(require_permission("lab.create"))])
async def create_order(order_data: LabOrderCreate, db: AsyncSession = Depends(get_db)):
    return await LabService.create_order(db, order_data)

@router.get("/orders/{order_id}", dependencies=[Depends(require_permission("lab.read"))])
async def get_order(order_id: UUID, db: AsyncSession = Depends(get_db)):
    return await LabService.get_order(db, order_id)

@router.put("/orders/{order_id}/status", dependencies=[Depends(require_permission("lab.update"))])
async def update_order_status(order_id: UUID, order_data: LabOrderUpdate, db: AsyncSession = Depends(get_db)):
    return await LabService.update_order_status(db, order_id, order_data)

@router.post("/orders/{order_id}/results", dependencies=[Depends(require_permission("lab.update"))])
async def submit_results(order_id: UUID, payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    items = payload.get("items", [])
    return await LabService.submit_order_results(db, order_id, items)

# PDF Generation
@router.get("/orders/{order_id}/pdf", dependencies=[Depends(require_permission("lab.read"))])
async def get_order_pdf(order_id: UUID, db: AsyncSession = Depends(get_db)):
    """Download a diagnostic report as a PDF."""
    pdf = await LabReportPDFGenerator.build(db, order_id)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="lab-report-{order_id}.pdf"'},
    )
