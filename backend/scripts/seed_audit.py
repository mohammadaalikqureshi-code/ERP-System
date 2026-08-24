import asyncio
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.clinic import Clinic
from app.models.user import User
from app.models.audit import AuditLog

AUDIT_EVENTS = [
    {"action": "USER_LOGIN", "entity_type": "Auth", "ip": "192.168.1.104", "details": {"method": "password", "status": "success"}},
    {"action": "PATIENT_REGISTERED", "entity_type": "Patient", "ip": "192.168.1.104", "details": {"patient_code": "PAT-2026-0042", "gender": "FEMALE"}},
    {"action": "APPOINTMENT_BOOKED", "entity_type": "Appointment", "ip": "192.168.1.104", "details": {"department": "Cardiology", "token": "A-001"}},
    {"action": "CONSULTATION_STARTED", "entity_type": "EMR", "ip": "192.168.1.115", "details": {"doctor": "Dr. Meera Raghavan", "status": "in_consultation"}},
    {"action": "PRESCRIPTION_CREATED", "entity_type": "Prescription", "ip": "192.168.1.115", "details": {"diagnosis": "Essential Hypertension", "items_count": 3}},
    {"action": "LAB_ORDER_SUBMITTED", "entity_type": "Lab", "ip": "192.168.1.115", "details": {"test_name": "Complete Blood Count", "priority": "routine"}},
    {"action": "LAB_RESULT_VERIFIED", "entity_type": "Lab", "ip": "192.168.1.122", "details": {"test_name": "Lipid Profile", "flag": "HIGH", "is_abnormal": True}},
    {"action": "GST_INVOICE_GENERATED", "entity_type": "Billing", "ip": "192.168.1.104", "details": {"bill_number": "INV-2026-0118", "amount": 1450.0, "gst": 261.0, "mode": "UPI"}},
    {"action": "PAYMENT_SETTLED", "entity_type": "Payment", "ip": "192.168.1.104", "details": {"gateway": "Razorpay", "transaction_id": "pay_O9vK81lJq"}},
    {"action": "INVENTORY_RESTOCK_PO", "entity_type": "Inventory", "ip": "192.168.1.130", "details": {"po_number": "PO-202608-0005", "supplier": "Cipla Ltd", "total": 12800.0}},
    {"action": "PASSWORD_RESET_REQUEST", "entity_type": "Auth", "ip": "192.168.1.140", "details": {"channel": "SMS_OTP", "verified": True}},
    {"action": "CLINIC_SETTINGS_UPDATED", "entity_type": "Settings", "ip": "192.168.1.101", "details": {"field": "cgst_rate", "old": "9.0", "new": "9.0"}},
]

async def seed_audit():
    async with async_session_factory() as session:
        clinics = (await session.execute(select(Clinic))).scalars().all()
        users = (await session.execute(select(User))).scalars().all()
        
        if not clinics or not users:
            print("Clinics or users missing.")
            return

        clinic = clinics[0]
        now = datetime.now()

        for idx, event in enumerate(AUDIT_EVENTS):
            user = users[idx % len(users)]
            time_offset = now - timedelta(minutes=idx * 25 + 5)
            
            audit = AuditLog(
                id=uuid.uuid4(),
                clinic_id=clinic.id,
                user_id=user.id,
                action=event["action"],
                entity_type=event["entity_type"],
                entity_id=uuid.uuid4(),
                old_value=None,
                new_value=event["details"],
                ip_address=event["ip"],
                created_at=time_offset
            )
            session.add(audit)

        await session.commit()
        print(f"Successfully seeded {len(AUDIT_EVENTS)} audit log records.")

if __name__ == "__main__":
    asyncio.run(seed_audit())
