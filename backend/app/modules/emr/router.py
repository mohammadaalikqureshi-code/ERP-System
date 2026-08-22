from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select

from app.core.exceptions import NotFoundError
from app.models.emr import Prescription
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.core.database import get_db
from app.middleware.rbac import require_permission
from app.modules.emr.schemas import VitalsCreate, VitalsUpdate, VitalsResponse, MedicalHistoryCreate, MedicalHistoryUpdate, MedicalHistoryResponse, PrescriptionCreate, PrescriptionResponse, EMRTemplateCreate, EMRTemplateUpdate, EMRTemplateResponse
from app.modules.emr.service import EMRService
from app.modules.emr.pdf_generator import PrescriptionPDFGenerator

router = APIRouter(prefix="/emr", tags=["EMR"])

# Vitals
@router.post("/vitals", dependencies=[Depends(require_permission("emr.create"))])
async def create_vitals(vitals_data: VitalsCreate, db: AsyncSession = Depends(get_db)):
    return await EMRService.create_vitals(db, vitals_data)

@router.put("/vitals/{vitals_id}", dependencies=[Depends(require_permission("emr.update"))])
async def update_vitals(vitals_id: UUID, vitals_data: VitalsUpdate, db: AsyncSession = Depends(get_db)):
    return await EMRService.update_vitals(db, vitals_id, vitals_data)

@router.get("/vitals/{appointment_id}")
@router.get("/vitals/appointment/{appointment_id}", dependencies=[Depends(require_permission("emr.read"))])
async def get_vitals(appointment_id: UUID, db: AsyncSession = Depends(get_db)):
    vitals = await EMRService.get_vitals_by_appointment(db, appointment_id)
    if not vitals:
        return {}
    return vitals

# Medical History
@router.post("/history", dependencies=[Depends(require_permission("emr.create"))])
async def add_medical_history(history_data: MedicalHistoryCreate, db: AsyncSession = Depends(get_db)):
    return await EMRService.create_medical_history(db, history_data)

@router.get("/history/{patient_id}")
@router.get("/history/patient/{patient_id}", dependencies=[Depends(require_permission("emr.read"))])
async def get_patient_history(patient_id: UUID, db: AsyncSession = Depends(get_db)):
    return await EMRService.get_patient_history(db, patient_id)

# Prescriptions
@router.post("/prescription")
@router.post("/prescriptions", dependencies=[Depends(require_permission("prescriptions.create"))])
async def create_prescription(pres_data: PrescriptionCreate, db: AsyncSession = Depends(get_db)):
    return await EMRService.create_prescription(db, pres_data)

@router.get("/prescription/{appointment_id}")
@router.get("/prescriptions/appointment/{appointment_id}")
async def get_prescription_by_appointment(appointment_id: UUID, db: AsyncSession = Depends(get_db)):
    pres = await EMRService.get_prescription_by_appointment(db, appointment_id)
    if not pres:
        return None
    return pres

@router.get("/prescriptions/{prescription_id}", dependencies=[Depends(require_permission("prescriptions.read"))])
async def get_prescription(prescription_id: UUID, db: AsyncSession = Depends(get_db)):
    pres = await EMRService.get_prescription(db, prescription_id)
    if not pres:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return pres

@router.get("/prescriptions/{prescription_id}/pdf", dependencies=[Depends(require_permission("prescriptions.read"))])
async def get_prescription_pdf(prescription_id: UUID, db: AsyncSession = Depends(get_db)):
    """Download a prescription as a PDF."""
    pdf = await PrescriptionPDFGenerator.build(db, prescription_id)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="prescription-{prescription_id}.pdf"'},
    )


@router.get("/prescription/{appointment_id}/pdf")
@router.get("/prescriptions/appointment/{appointment_id}/pdf")
async def get_prescription_by_appointment_pdf(appointment_id: UUID, db: AsyncSession = Depends(get_db)):
    """Download the prescription written during a given consultation."""
    prescription = (await db.execute(
        select(Prescription).where(Prescription.appointment_id == appointment_id)
    )).scalar_one_or_none()
    if not prescription:
        raise NotFoundError("No prescription has been written for this consultation yet.")

    pdf = await PrescriptionPDFGenerator.build(db, prescription.id)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="prescription-{appointment_id}.pdf"'},
    )


# EMR Templates
@router.post("/templates", response_model=EMRTemplateResponse, dependencies=[Depends(require_permission("emr.create"))])
async def create_template(template_data: EMRTemplateCreate, db: AsyncSession = Depends(get_db)):
    return await EMRService.create_template(db, template_data)

@router.get("/templates/clinic/{clinic_id}", response_model=List[EMRTemplateResponse], dependencies=[Depends(require_permission("emr.read"))])
async def list_templates(clinic_id: UUID, db: AsyncSession = Depends(get_db)):
    return await EMRService.list_templates(db, clinic_id)

@router.get("/templates/{template_id}", response_model=EMRTemplateResponse, dependencies=[Depends(require_permission("emr.read"))])
async def get_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    return await EMRService.get_template(db, template_id)

@router.put("/templates/{template_id}", response_model=EMRTemplateResponse, dependencies=[Depends(require_permission("emr.update"))])
async def update_template(template_id: UUID, template_data: EMRTemplateUpdate, db: AsyncSession = Depends(get_db)):
    return await EMRService.update_template(db, template_id, template_data)

@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("emr.delete"))])
async def delete_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    await EMRService.delete_template(db, template_id)
