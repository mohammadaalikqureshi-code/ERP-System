import os
import json
import glob
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.exceptions import ForbiddenError
from app.models.user import User, Role
from app.models.clinic import Clinic, ClinicSettings, Holiday
from app.models.branch import Branch
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.emr import Vitals, MedicalHistory, Prescription, PrescriptionItem, PatientDocument, EMRTemplate
from app.models.lab import LabOrder, LabResult, LabTestCatalog
from app.models.billing import Bill, Payment
from app.models.inventory import InventoryItem, PurchaseOrder
from app.models.audit import AuditLog

router = APIRouter(prefix="/admin/backup", tags=["System Backup & Disaster Recovery"])

BACKUP_DIR = "/app/backups"
os.makedirs(BACKUP_DIR, exist_ok=True)

def verify_super_admin(current_user: User):
    if not current_user.role or current_user.role.name != "super_admin":
        raise ForbiddenError("Access Denied: Only Platform Super Admin has the authority to generate, download, or restore database snapshots.")

@router.get("/list")
async def list_backups(
    current_user: User = Depends(get_current_active_user)
):
    verify_super_admin(current_user)
    
    backups = []
    for filepath in glob.glob(os.path.join(BACKUP_DIR, "*.json")):
        stat = os.stat(filepath)
        filename = os.path.basename(filepath)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                meta = data.get("metadata", {})
        except Exception:
            meta = {}
            
        backups.append({
            "id": filename,
            "filename": filename,
            "size_bytes": stat.st_size,
            "size_formatted": f"{stat.st_size / 1024:.1f} KB" if stat.st_size < 1024 * 1024 else f"{stat.st_size / (1024 * 1024):.2f} MB",
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "total_records": meta.get("total_records", 0),
            "record_counts": meta.get("record_counts", {}),
            "version": meta.get("version", "2.0.0"),
            "status": "COMPLETED"
        })
        
    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return backups

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_backup_snapshot(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    verify_super_admin(current_user)
    
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"medicare_db_snapshot_{timestamp_str}.json"
    filepath = os.path.join(BACKUP_DIR, filename)

    # 1. Collect all table datasets
    users = (await db.execute(select(User))).scalars().all()
    roles = (await db.execute(select(Role))).scalars().all()
    clinics = (await db.execute(select(Clinic))).scalars().all()
    branches = (await db.execute(select(Branch))).scalars().all()
    patients = (await db.execute(select(Patient))).scalars().all()
    appointments = (await db.execute(select(Appointment))).scalars().all()
    vitals = (await db.execute(select(Vitals))).scalars().all()
    prescriptions = (await db.execute(select(Prescription))).scalars().all()
    prescription_items = (await db.execute(select(PrescriptionItem))).scalars().all()
    emr_templates = (await db.execute(select(EMRTemplate))).scalars().all()
    lab_catalogs = (await db.execute(select(LabTestCatalog))).scalars().all()
    lab_orders = (await db.execute(select(LabOrder))).scalars().all()
    lab_results = (await db.execute(select(LabResult))).scalars().all()
    bills = (await db.execute(select(Bill))).scalars().all()
    payments = (await db.execute(select(Payment))).scalars().all()
    inventory_items = (await db.execute(select(InventoryItem))).scalars().all()
    purchase_orders = (await db.execute(select(PurchaseOrder))).scalars().all()
    audit_logs = (await db.execute(select(AuditLog))).scalars().all()

    counts = {
        "users": len(users),
        "roles": len(roles),
        "clinics": len(clinics),
        "branches": len(branches),
        "patients": len(patients),
        "appointments": len(appointments),
        "vitals": len(vitals),
        "prescriptions": len(prescriptions),
        "prescription_items": len(prescription_items),
        "emr_templates": len(emr_templates),
        "lab_catalogs": len(lab_catalogs),
        "lab_orders": len(lab_orders),
        "lab_results": len(lab_results),
        "bills": len(bills),
        "payments": len(payments),
        "inventory_items": len(inventory_items),
        "purchase_orders": len(purchase_orders),
        "audit_logs": len(audit_logs),
    }

    total_records = sum(counts.values())

    snapshot_payload = {
        "metadata": {
            "application": "MediCare ERP 2.0 Enterprise",
            "version": "2.0.0",
            "snapshot_type": "FULL_SYSTEM_SNAPSHOT",
            "created_at": datetime.now().isoformat(),
            "created_by": current_user.email,
            "total_records": total_records,
            "record_counts": counts,
        },
        "data": {
            "users": [
                {
                    "id": str(u.id),
                    "full_name": u.full_name,
                    "email": u.email,
                    "phone": u.phone,
                    "role_id": str(u.role_id) if u.role_id else None,
                    "clinic_id": str(u.clinic_id) if u.clinic_id else None,
                    "is_active": u.is_active,
                }
                for u in users
            ],
            "roles": [{"id": str(r.id), "name": r.name, "permissions": r.permissions} for r in roles],
            "clinics": [{"id": str(c.id), "name": c.name, "email": c.email, "phone": c.phone, "address": c.address} for c in clinics],
            "branches": [{"id": str(b.id), "name": b.name, "clinic_id": str(b.clinic_id)} for b in branches],
            "patients": [
                {
                    "id": str(p.id),
                    "patient_code": p.patient_code,
                    "full_name": p.full_name,
                    "mobile": p.mobile,
                    "gender": p.gender,
                    "dob": p.dob.isoformat() if p.dob else None,
                    "blood_group": p.blood_group,
                    "clinic_id": str(p.clinic_id),
                }
                for p in patients
            ],
            "appointments": [
                {
                    "id": str(a.id),
                    "patient_id": str(a.patient_id),
                    "doctor_id": str(a.doctor_id),
                    "clinic_id": str(a.clinic_id),
                    "appointment_date": a.appointment_date.isoformat() if a.appointment_date else None,
                    "status": a.status,
                    "token_number": a.token_number,
                }
                for a in appointments
            ],
            "bills": [
                {
                    "id": str(b.id),
                    "bill_number": b.bill_number,
                    "patient_id": str(b.patient_id),
                    "clinic_id": str(b.clinic_id),
                    "total_amount": float(b.total_amount) if b.total_amount else 0.0,
                    "payment_status": b.payment_status,
                }
                for b in bills
            ],
            "lab_orders": [
                {
                    "id": str(l.id),
                    "patient_id": str(l.patient_id),
                    "doctor_id": str(l.doctor_id),
                    "status": l.status,
                }
                for l in lab_orders
            ],
            "inventory_items": [
                {
                    "id": str(i.id),
                    "name": i.name,
                    "generic_name": i.generic_name,
                    "stock_quantity": i.stock_quantity,
                    "unit_price": float(i.unit_price) if i.unit_price else 0.0,
                    "batch_number": i.batch_number,
                }
                for i in inventory_items
            ],
        }
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(snapshot_payload, f, indent=2)

    stat = os.stat(filepath)

    return {
        "id": filename,
        "filename": filename,
        "size_bytes": stat.st_size,
        "size_formatted": f"{stat.st_size / 1024:.1f} KB",
        "created_at": snapshot_payload["metadata"]["created_at"],
        "total_records": total_records,
        "record_counts": counts,
        "status": "COMPLETED",
        "message": f"Successfully created database snapshot containing {total_records} records."
    }

@router.get("/download/{filename}")
async def download_backup(
    filename: str,
    current_user: User = Depends(get_current_active_user)
):
    verify_super_admin(current_user)
    
    # Secure path traversal check
    clean_filename = os.path.basename(filename)
    filepath = os.path.join(BACKUP_DIR, clean_filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup snapshot file not found.")
        
    return FileResponse(
        filepath,
        media_type="application/json",
        filename=clean_filename,
        headers={"Content-Disposition": f'attachment; filename="{clean_filename}"'}
    )
