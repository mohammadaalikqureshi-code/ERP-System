from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from sqlalchemy.orm import selectinload
from app.models.billing import Bill, Payment
from app.models.clinic import ClinicSettings
from app.modules.billing.schemas import BillCreate, PaymentCreate
from app.core.exceptions import NotFoundError, ValidationError
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.lab import LabTestCatalog
from app.models.clinic import Clinic
from app.models.patient import Patient
from app.documents.pdf import render_pdf
from app.documents.templates import receipt_html
from app.websockets.events import Events, build, room_for_clinic
from app.websockets.queue_manager import manager
import uuid
from datetime import datetime, timezone, date as date_type
from decimal import Decimal

class BillingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_bill_number(self, clinic_id: uuid.UUID) -> str:
        now = datetime.now(timezone.utc)
        prefix = f"INV-{now.strftime('%Y%m')}"
        
        stmt = select(func.count(Bill.id)).where(
            Bill.clinic_id == clinic_id,
            Bill.bill_number.like(f"{prefix}%")
        )
        count = (await self.db.execute(stmt)).scalar() or 0
        return f"{prefix}-{count + 1:04d}"

    def _format_bill(self, bill: Bill) -> dict:
        patient_dict = None
        if bill.patient:
            name_parts = bill.patient.full_name.split(" ", 1) if bill.patient.full_name else ["", ""]
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""
            patient_dict = {
                "id": str(bill.patient.id),
                "patientCode": bill.patient.patient_code,
                "firstName": first_name,
                "lastName": last_name,
                "mobile": bill.patient.mobile
            }

        return {
            "id": bill.id,
            "clinic_id": bill.clinic_id,
            "patient_id": bill.patient_id,
            "patientId": bill.patient_id,
            "appointment_id": bill.appointment_id,
            "bill_number": bill.bill_number,
            "billNumber": bill.bill_number,
            "bill_type": bill.bill_type,
            "line_items": bill.line_items or [],
            "items": bill.line_items or [],
            "subtotal": bill.subtotal,
            "discount_amount": bill.discount_amount,
            "discount": bill.discount_amount,
            "gst_amount": bill.gst_amount,
            "cgst_amount": bill.cgst_amount,
            "sgst_amount": bill.sgst_amount,
            "total_amount": bill.total_amount,
            "totalAmount": bill.total_amount,
            "payment_status": bill.payment_status,
            "status": bill.payment_status,
            "payment_mode": bill.payment_mode,
            "razorpay_order_id": bill.razorpay_order_id,
            "razorpay_payment_id": bill.razorpay_payment_id,
            "hsn_sac_code": bill.hsn_sac_code,
            "notes": bill.notes,
            "patient": patient_dict,
            "created_at": bill.created_at,
            "createdAt": bill.created_at
        }

    async def create_bill(self, clinic_id: uuid.UUID, user_id: uuid.UUID, data: BillCreate):
        # 1. Get Clinic Settings for GST (split CGST/SGST)
        stmt = select(ClinicSettings).where(ClinicSettings.clinic_id == clinic_id)
        settings = (await self.db.execute(stmt)).scalar_one_or_none()
        gst_rate = Decimal(str(settings.gst_rate)) if settings else Decimal('18.0')
        cgst_rate = Decimal(str(settings.cgst_rate)) if settings and settings.cgst_rate else gst_rate / 2
        sgst_rate = Decimal(str(settings.sgst_rate)) if settings and settings.sgst_rate else gst_rate / 2

        # 2. Extract inputs
        patient_id = data.patientId or data.patient_id
        if not patient_id:
            raise ValidationError("Patient ID is required")

        raw_items = data.items or data.line_items or []
        discount_amount = data.discount or data.discount_amount or Decimal('0')
        bill_type = data.bill_type or "consultation"
        payment_mode = data.paymentMode or data.payment_mode or "CASH"

        # 3. Calculate amounts with CGST/SGST split
        formatted_items = []
        subtotal = Decimal('0')
        for item in raw_items:
            unit_price = item.unitPrice if item.unitPrice is not None else (item.unit_price if item.unit_price is not None else Decimal('0'))
            amount = item.amount if item.amount is not None else (Decimal(item.quantity) * unit_price)
            subtotal += amount
            formatted_items.append({
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": float(unit_price),
                "unitPrice": float(unit_price),
                "amount": float(amount),
                "hsn_code": getattr(item, 'hsn_code', None) or "",
            })

        if discount_amount > subtotal:
            raise ValidationError("Discount cannot exceed subtotal")
            
        taxable_amount = subtotal - discount_amount
        cgst_amount = taxable_amount * (cgst_rate / Decimal('100'))
        sgst_amount = taxable_amount * (sgst_rate / Decimal('100'))
        gst_amount = cgst_amount + sgst_amount
        total_amount = taxable_amount + gst_amount

        bill_number = await self._generate_bill_number(clinic_id)

        bill = Bill(
            clinic_id=clinic_id,
            patient_id=patient_id,
            appointment_id=data.appointmentId or data.appointment_id,
            bill_number=bill_number,
            bill_type=bill_type,
            line_items=formatted_items,
            subtotal=subtotal,
            discount_amount=discount_amount,
            gst_amount=gst_amount,
            cgst_amount=cgst_amount,
            sgst_amount=sgst_amount,
            total_amount=total_amount,
            payment_mode=payment_mode.lower(),
            payment_status="paid",
            created_by=user_id,
            hsn_sac_code=getattr(data, 'hsn_sac_code', None) or "9993",
        )
        self.db.add(bill)
        await self.db.flush()

        # Record payment
        payment = Payment(
            bill_id=bill.id,
            amount=total_amount,
            mode=payment_mode.lower(),
            status="success",
            paid_at=datetime.now(timezone.utc)
        )
        self.db.add(payment)
        await self.db.commit()

        # Reload with patient
        stmt = select(Bill).options(selectinload(Bill.patient)).where(Bill.id == bill.id)
        reloaded = (await self.db.execute(stmt)).scalar_one()

        await manager.broadcast(
            room_for_clinic(clinic_id),
            build(Events.BILL_CREATED, bill.id, total=float(bill.total_amount)),
        )

        try:
            from app.modules.notifications.service import NotificationService
            patient_name = reloaded.patient.full_name if reloaded.patient else "Patient"
            await NotificationService(self.db).create_and_broadcast(
                clinic_id=clinic_id,
                title="Invoice & Payment Settled",
                message=f"Bill #{bill.bill_number} for ₹{float(bill.total_amount):.2f} generated for {patient_name}.",
                category="billing",
                target_role="clinic_admin",
                sender_name="Billing Desk",
                sender_user_id=user_id,
                link="/reception/billing",
            )
        except Exception:
            pass

        # Send payment SMS
        try:
            from app.core.sms_gateway import SMSGateway
            if reloaded.patient and reloaded.patient.mobile:
                gateway = await SMSGateway.for_clinic(self.db, clinic_id)
                await gateway.send_payment_receipt(
                    reloaded.patient.mobile,
                    reloaded.patient.full_name,
                    float(total_amount),
                    bill_number,
                )
        except Exception:
            pass

        return self._format_bill(reloaded)

    async def get_bill(self, clinic_id: uuid.UUID, bill_id: uuid.UUID):
        stmt = select(Bill).options(selectinload(Bill.patient)).where(Bill.id == bill_id, Bill.clinic_id == clinic_id)
        bill = (await self.db.execute(stmt)).scalar_one_or_none()
        if not bill:
            raise NotFoundError("Bill not found")
        return self._format_bill(bill)

    async def list_bills(self, clinic_id: uuid.UUID, page: int = 1, size: int = 20):
        stmt = select(Bill).options(selectinload(Bill.patient)).where(Bill.clinic_id == clinic_id).order_by(Bill.created_at.desc())
        
        count_stmt = select(func.count(Bill.id)).where(Bill.clinic_id == clinic_id)
        total = (await self.db.execute(count_stmt)).scalar() or 0
        
        stmt = stmt.offset((page - 1) * size).limit(size)
        items = (await self.db.execute(stmt)).scalars().all()
        
        formatted = [self._format_bill(b) for b in items]
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

    async def record_payment(self, clinic_id: uuid.UUID, bill_id: uuid.UUID, data: PaymentCreate):
        """Record a payment against a bill and update whether it is settled."""
        stmt = select(Bill).where(Bill.id == bill_id, Bill.clinic_id == clinic_id)
        bill = (await self.db.execute(stmt)).scalar_one_or_none()
        if not bill:
            raise NotFoundError("Bill not found")

        if data.amount <= 0:
            raise ValidationError("Payment amount must be greater than zero.")

        already_paid = (await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.bill_id == bill.id, Payment.status == "success"
            )
        )).scalar() or 0

        outstanding = Decimal(str(bill.total_amount)) - Decimal(str(already_paid))
        if Decimal(str(data.amount)) > outstanding:
            raise ValidationError(
                f"That is more than the outstanding amount of {outstanding:.2f}."
            )

        payment = Payment(
            bill_id=bill.id,
            amount=data.amount,
            mode=data.mode,
            gateway_txn_id=data.gateway_txn_id,
            status="success",
            paid_at=datetime.now(timezone.utc),
        )
        self.db.add(payment)

        if Decimal(str(already_paid)) + Decimal(str(data.amount)) >= Decimal(str(bill.total_amount)):
            bill.payment_status = "paid"
        else:
            bill.payment_status = "partial"

        await self.db.commit()
        await self.db.refresh(payment)

        await manager.broadcast(
            room_for_clinic(clinic_id),
            build(Events.PAYMENT_RECORDED, bill.id, status=bill.payment_status),
        )
        return payment

    async def generate_receipt_pdf(self, clinic_id: uuid.UUID, bill_id: uuid.UUID) -> bytes:
        """Render the GST receipt for a bill as a real PDF with CGST/SGST split."""
        bill = (await self.db.execute(
            select(Bill).options(selectinload(Bill.patient)).where(
                Bill.id == bill_id, Bill.clinic_id == clinic_id
            )
        )).scalar_one_or_none()
        if not bill:
            raise NotFoundError("Bill not found")

        clinic = (await self.db.execute(
            select(Clinic).where(Clinic.id == clinic_id)
        )).scalar_one_or_none()

        html = receipt_html(
            clinic={
                "name": clinic.name if clinic else "Clinic",
                "address": clinic.address if clinic else "",
                "phone": clinic.phone if clinic else "",
                "email": clinic.email if clinic else "",
                "gst_number": clinic.gst_number if clinic else None,
            },
            patient={
                "full_name": bill.patient.full_name if bill.patient else "—",
                "patient_code": bill.patient.patient_code if bill.patient else "—",
                "age": bill.patient.age if bill.patient else None,
                "gender": bill.patient.gender if bill.patient else None,
                "mobile": bill.patient.mobile if bill.patient else None,
            },
            bill={
                "bill_number": bill.bill_number,
                "line_items": bill.line_items or [],
                "subtotal": bill.subtotal,
                "discount_amount": bill.discount_amount,
                "gst_amount": bill.gst_amount,
                "cgst_amount": bill.cgst_amount or 0,
                "sgst_amount": bill.sgst_amount or 0,
                "total_amount": bill.total_amount,
                "payment_status": bill.payment_status,
                "payment_mode": bill.payment_mode,
                "hsn_sac_code": bill.hsn_sac_code,
            },
        )
        return render_pdf(html)

    async def daily_cash_register(self, clinic_id: uuid.UUID, register_date: date_type = None) -> dict:
        """Generate a daily cash register / shift closing report."""
        target_date = register_date or date_type.today()

        # All bills for the day
        stmt = select(Bill).where(
            Bill.clinic_id == clinic_id,
            cast(Bill.created_at, Date) == target_date,
        )
        bills = (await self.db.execute(stmt)).scalars().all()

        # All payments for the day
        payment_stmt = select(Payment).join(Bill).where(
            Bill.clinic_id == clinic_id,
            cast(Payment.paid_at, Date) == target_date,
            Payment.status == "success",
        )
        payments = (await self.db.execute(payment_stmt)).scalars().all()

        # Aggregate by payment mode
        mode_totals = {}
        for p in payments:
            mode = (p.mode or "cash").upper()
            mode_totals[mode] = mode_totals.get(mode, 0) + float(p.amount or 0)

        total_revenue = sum(mode_totals.values())
        total_bills = len(bills)
        paid_count = sum(1 for b in bills if b.payment_status == "paid")
        pending_count = sum(1 for b in bills if b.payment_status == "pending")
        total_gst = sum(float(b.gst_amount or 0) for b in bills)
        total_discount = sum(float(b.discount_amount or 0) for b in bills)

        return {
            "date": target_date.isoformat(),
            "clinicId": str(clinic_id),
            "totalBills": total_bills,
            "paidBills": paid_count,
            "pendingBills": pending_count,
            "totalRevenue": round(total_revenue, 2),
            "totalGST": round(total_gst, 2),
            "totalDiscount": round(total_discount, 2),
            "byPaymentMode": mode_totals,
            "breakdown": [
                {
                    "billNumber": b.bill_number,
                    "billType": b.bill_type,
                    "total": float(b.total_amount or 0),
                    "gst": float(b.gst_amount or 0),
                    "status": b.payment_status,
                    "mode": (b.payment_mode or "cash").upper(),
                    "time": str(b.created_at),
                }
                for b in bills
            ],
        }
