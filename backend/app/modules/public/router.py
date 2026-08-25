"""Endpoints that do not require a login.

1. Waiting-room live queue display.
2. Public Clinic Self-Service Onboarding & SaaS Subscription setup.
3. Public Patient Reports Portal (Search by Serial No / Patient Code / Mobile, View Lab & Rx Reports, 1-Click PDF Downloads).
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, EmailStr
from redis.asyncio import Redis
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.core.redis import get_redis
from app.core.security import get_password_hash
from app.middleware.rate_limit import rate_limiter
from app.models.appointment import Appointment
from app.models.billing import Bill
from app.models.clinic import Clinic, ClinicSettings
from app.models.doctor import Doctor
from app.models.emr import Prescription
from app.models.lab import LabOrder, LabResult
from app.models.patient import Patient
from app.models.user import Role, User
from app.modules.auth.service import AuthService
from app.modules.billing.service import BillingService
from app.modules.emr.pdf_generator import PrescriptionPDFGenerator
from app.modules.lab.pdf_generator import LabReportPDFGenerator

router = APIRouter(prefix="/public", tags=["Public"])

# Statuses that put a patient on the board.
IN_QUEUE = ("booked", "checked_in")


# =====================================================================
# 1. Waiting Room Live Queue Display
# =====================================================================

@router.get("/queue", dependencies=[Depends(rate_limiter(limit=60, scope="public-queue"))])
async def public_queue(
    clinic_id: Optional[uuid.UUID] = Query(None),
    clinicId: Optional[uuid.UUID] = Query(None),
    doctor_id: Optional[uuid.UUID] = Query(None),
    doctorId: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """The token board for a waiting room."""
    clinic_id = clinic_id or clinicId
    doctor_id = doctor_id or doctorId
    if not clinic_id:
        raise ValidationError("A clinic id is required, e.g. ?clinicId=<uuid>")

    clinic = (
        await db.execute(
            select(Clinic).where(Clinic.id == clinic_id, Clinic.is_active == True)
        )
    ).scalar_one_or_none()
    if not clinic:
        raise NotFoundError("Clinic not found")

    statement = (
        select(Appointment)
        .options(selectinload(Appointment.doctor).selectinload(Doctor.user))
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date == date.today(),
        )
        .order_by(Appointment.queue_number)
    )
    if doctor_id:
        statement = statement.where(Appointment.doctor_id == doctor_id)

    appointments = list((await db.execute(statement)).scalars().all())

    def doctor_name(appointment: Appointment) -> Optional[str]:
        if appointment.doctor and appointment.doctor.user:
            return appointment.doctor.user.full_name
        return None

    current = next((a for a in appointments if a.status == "in_consultation"), None)
    waiting = [a for a in appointments if a.status in IN_QUEUE]

    return {
        "clinic_name": clinic.name,
        "current": (
            {
                "token_number": current.token_number,
                "doctor_name": doctor_name(current),
                "department": current.department,
            }
            if current
            else None
        ),
        "waiting": [{"token_number": a.token_number} for a in waiting[:10]],
        "waiting_count": len(waiting),
        "completed_count": sum(1 for a in appointments if a.status == "completed"),
    }


# =====================================================================
# 2. Public Self-Service Clinic Onboarding & SaaS Registration
# =====================================================================

class ClinicRegisterRequest(BaseModel):
    clinic_name: str
    address: str
    phone: str
    email: EmailStr
    gst_number: Optional[str] = None
    tagline: Optional[str] = None
    admin_name: str
    admin_email: EmailStr
    admin_password: str
    admin_phone: str
    plan_tier: Optional[str] = "professional"  # starter, professional, enterprise


@router.post("/register-clinic", dependencies=[Depends(rate_limiter(limit=10, scope="clinic-reg"))])
async def register_clinic(
    payload: ClinicRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    """Public self-service hospital/clinic onboarding with SaaS trial provisioning."""
    existing_user = (await db.execute(
        select(User).where((User.email == payload.admin_email) | (User.phone == payload.admin_phone))
    )).scalar_one_or_none()
    if existing_user:
        raise ValidationError("An account with this administrator email or phone already exists.")

    admin_role = (await db.execute(
        select(Role).where(Role.name == "clinic_admin")
    )).scalar_one_or_none()
    if not admin_role:
        raise NotFoundError("System default role 'clinic_admin' not configured.")

    clinic = Clinic(
        name=payload.clinic_name,
        address=payload.address,
        phone=payload.phone,
        email=payload.email,
        gst_number=payload.gst_number,
        tagline=payload.tagline or "Quality Healthcare Services",
        primary_color="#0d9488",
        is_active=True,
    )
    db.add(clinic)
    await db.flush()

    clinic_settings = ClinicSettings(
        clinic_id=clinic.id,
        gst_rate=18.0,
        cgst_rate=9.0,
        sgst_rate=9.0,
        tts_enabled=True,
        tts_language="en-IN",
        auto_sms_appointment=True,
        auto_sms_prescription=True,
        auto_sms_lab_report=True,
    )
    db.add(clinic_settings)

    admin_user = User(
        clinic_id=clinic.id,
        role_id=admin_role.id,
        full_name=payload.admin_name,
        email=payload.admin_email,
        phone=payload.admin_phone,
        password_hash=get_password_hash(payload.admin_password),
        is_active=True,
    )
    db.add(admin_user)
    await db.commit()

    stmt = select(User).options(selectinload(User.role)).where(User.id == admin_user.id)
    reloaded_user = (await db.execute(stmt)).scalar_one()

    auth_service = AuthService(db, redis)
    tokens = await auth_service.generate_tokens(reloaded_user)

    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=tokens["refresh_token"],
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN or None,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )

    return {
        "message": "Clinic and administrator account successfully provisioned.",
        "clinic": {
            "id": str(clinic.id),
            "name": clinic.name,
            "email": clinic.email,
            "plan_tier": payload.plan_tier,
            "trial_days": 14,
        },
        "accessToken": tokens["access_token"],
        "tokenType": "bearer",
        "profile": tokens["profile"],
    }


# =====================================================================
# 3. Public Patient Reports Portal (Zero-Login / Instant Lookup)
# =====================================================================

@router.get("/patient-reports/search", dependencies=[Depends(rate_limiter(limit=60, scope="public-reports"))])
async def search_patient_reports(
    query: str = Query(..., min_length=2, description="Patient Serial No, Patient Code, Mobile Number, or Name"),
    db: AsyncSession = Depends(get_db),
):
    """Public patient medical reports lookup by Serial Number / Patient Code or Mobile.
    
    Zero login required. Returns all Diagnostic Lab Reports, Doctor Prescriptions,
    Bills & Invoices, and Appointments for the matching patient.
    """
    clean_q = query.strip()
    
    # 1. Search for patient
    conditions = [
        Patient.patient_code.ilike(f"%{clean_q}%"),
        Patient.mobile.contains(clean_q[-10:] if len(clean_q) >= 10 else clean_q),
        Patient.full_name.ilike(f"%{clean_q}%"),
    ]
    
    try:
        parsed_uuid = uuid.UUID(clean_q)
        conditions.append(Patient.id == parsed_uuid)
    except ValueError:
        pass

    stmt = select(Patient).where(
        or_(*conditions),
        Patient.is_deleted == False
    ).order_by(Patient.created_at.desc())

    patient = (await db.execute(stmt)).scalars().first()

    if not patient:
        return {
            "found": False,
            "message": f"No patient records found matching '{clean_q}'. Please check your Serial No / Patient ID / Mobile number."
        }

    # 2. Fetch Clinic Info
    clinic = (await db.execute(select(Clinic).where(Clinic.id == patient.clinic_id))).scalar_one_or_none()

    # 3. Fetch Lab Orders with Results & Catalog Tests
    lab_stmt = (
        select(LabOrder)
        .options(
            selectinload(LabOrder.doctor).selectinload(Doctor.user),
            selectinload(LabOrder.results).selectinload(LabResult.test),
        )
        .where(LabOrder.patient_id == patient.id)
        .order_by(LabOrder.created_at.desc())
    )
    lab_orders = list((await db.execute(lab_stmt)).scalars().all())

    formatted_lab_orders = []
    for order in lab_orders:
        has_abnormal = any(r.is_abnormal for r in order.results)
        has_critical = any(r.flag in ("CRITICAL_HIGH", "CRITICAL_LOW") for r in order.results)
        
        results_data = []
        for r in order.results:
            results_data.append({
                "id": str(r.id),
                "testName": r.test.test_name if r.test else "Diagnostic Test",
                "category": r.test.category if r.test else "General",
                "resultValue": r.result_value,
                "unit": r.unit or (r.test.unit if r.test else ""),
                "referenceRange": r.reference_range or (r.test.normal_range if r.test else ""),
                "flag": r.flag or ("ABNORMAL" if r.is_abnormal else "NORMAL"),
                "isAbnormal": r.is_abnormal,
                "remarks": r.remarks or "",
            })

        formatted_lab_orders.append({
            "id": str(order.id),
            "orderNumber": f"LAB-{str(order.id)[:8].upper()}",
            "orderDate": order.created_at.isoformat() if order.created_at else None,
            "status": order.status,
            "doctorName": order.doctor.user.full_name if order.doctor and order.doctor.user else "Attending Physician",
            "hasAbnormal": has_abnormal,
            "hasCritical": has_critical,
            "testsCount": len(order.results),
            "results": results_data,
            "pdfUrl": f"/api/v1/public/reports/lab/{order.id}/pdf",
        })

    # 4. Fetch Prescriptions with Medicines
    rx_stmt = (
        select(Prescription)
        .options(
            selectinload(Prescription.items),
            selectinload(Prescription.doctor).selectinload(Doctor.user),
            selectinload(Prescription.appointment),
        )
        .where(Prescription.patient_id == patient.id)
        .order_by(Prescription.created_at.desc())
    )
    prescriptions = list((await db.execute(rx_stmt)).scalars().all())

    formatted_prescriptions = []
    for rx in prescriptions:
        medicines_data = [
            {
                "id": str(item.id),
                "medicineName": item.medicine_name,
                "dosage": item.dosage,
                "frequency": item.frequency,
                "durationDays": item.duration_days,
                "instructions": item.instructions or "As advised",
            }
            for item in rx.items
        ]

        formatted_prescriptions.append({
            "id": str(rx.id),
            "rxNumber": f"RX-{str(rx.id)[:8].upper()}",
            "date": rx.created_at.isoformat() if rx.created_at else None,
            "doctorName": rx.doctor.user.full_name if rx.doctor and rx.doctor.user else "Consultant Doctor",
            "department": rx.doctor.department if rx.doctor else "General OPD",
            "notes": rx.notes or "",
            "medicines": medicines_data,
            "pdfUrl": f"/api/v1/public/reports/prescription/{rx.id}/pdf",
        })

    # 5. Fetch Bills & Invoices
    bill_stmt = (
        select(Bill)
        .options(selectinload(Bill.payments))
        .where(Bill.patient_id == patient.id, Bill.is_deleted == False)
        .order_by(Bill.created_at.desc())
    )
    bills = list((await db.execute(bill_stmt)).scalars().all())

    formatted_bills = []
    for b in bills:
        formatted_bills.append({
            "id": str(b.id),
            "billNumber": b.bill_number,
            "billType": b.bill_type,
            "date": b.created_at.isoformat() if b.created_at else None,
            "lineItems": b.line_items or [],
            "subtotal": float(b.subtotal or 0),
            "discount": float(b.discount_amount or 0),
            "cgstAmount": float(b.cgst_amount or 0),
            "sgstAmount": float(b.sgst_amount or 0),
            "gstAmount": float(b.gst_amount or 0),
            "totalAmount": float(b.total_amount or 0),
            "paymentMode": b.payment_mode or "CASH",
            "paymentStatus": b.payment_status or "PAID",
            "pdfUrl": f"/api/v1/public/reports/bill/{b.id}/pdf",
        })

    # 6. Fetch Appointments / Visits
    apt_stmt = (
        select(Appointment)
        .options(selectinload(Appointment.doctor).selectinload(Doctor.user))
        .where(Appointment.patient_id == patient.id)
        .order_by(Appointment.appointment_date.desc(), Appointment.queue_number.desc())
    )
    appointments = list((await db.execute(apt_stmt)).scalars().all())

    formatted_appointments = []
    for a in appointments:
        formatted_appointments.append({
            "id": str(a.id),
            "tokenNumber": a.token_number,
            "appointmentDate": a.appointment_date.isoformat() if a.appointment_date else None,
            "department": a.department,
            "doctorName": a.doctor.user.full_name if a.doctor and a.doctor.user else "Consultant",
            "status": a.status,
            "queueNumber": a.queue_number,
        })

    return {
        "found": True,
        "patient": {
            "id": str(patient.id),
            "patientCode": patient.patient_code,
            "fullName": patient.full_name,
            "age": patient.age,
            "gender": patient.gender,
            "bloodGroup": patient.blood_group or "—",
            "mobile": f"{patient.mobile[:3]}****{patient.mobile[-3:]}" if len(patient.mobile) >= 7 else patient.mobile,
            "clinicName": clinic.name if clinic else "Medicare Hospital",
            "registeredDate": patient.created_at.isoformat() if patient.created_at else None,
        },
        "labOrders": formatted_lab_orders,
        "prescriptions": formatted_prescriptions,
        "bills": formatted_bills,
        "appointments": formatted_appointments,
    }


# =====================================================================
# 4. Public PDF Downloads (1-Click Direct Download for Patients)
# =====================================================================

@router.get("/reports/lab/{order_id}/pdf")
async def download_public_lab_report(order_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Public 1-click download of verified laboratory diagnostic report."""
    pdf_bytes = await LabReportPDFGenerator.build(db, order_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="lab-report-{str(order_id)[:8]}.pdf"'},
    )


@router.get("/reports/prescription/{prescription_id}/pdf")
async def download_public_prescription(prescription_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Public 1-click download of doctor's official prescription."""
    pdf_bytes = await PrescriptionPDFGenerator.build(db, prescription_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="prescription-{str(prescription_id)[:8]}.pdf"'},
    )


@router.get("/reports/bill/{bill_id}/pdf")
async def download_public_bill_receipt(bill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Public 1-click download of GST payment receipt and invoice."""
    bill = (await db.execute(select(Bill).where(Bill.id == bill_id))).scalar_one_or_none()
    if not bill:
        raise NotFoundError("Bill not found")
    pdf_bytes = await BillingService(db).generate_receipt_pdf(bill.clinic_id, bill_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="tax-invoice-{str(bill_id)[:8]}.pdf"'},
    )
