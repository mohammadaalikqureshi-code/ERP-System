import asyncio
import uuid
from datetime import datetime, date, time
from decimal import Decimal
from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.emr import Prescription, PrescriptionItem, Vitals
from app.models.lab import LabOrder, LabResult, LabTestCatalog
from app.models.billing import Bill, Payment

TEST_SERIAL_NO = "PT-10001"
TEST_MOBILE = "9876543210"
TEST_NAME = "Rajesh Kumar Verma"

async def seed_demo_patient():
    async with AsyncSessionLocal() as session:
        # 1. Get Clinic
        clinic = (await session.execute(select(Clinic).limit(1))).scalar_one_or_none()
        if not clinic:
            print("No clinic found!")
            return

        # 2. Get Doctor
        doctor = (await session.execute(select(Doctor).where(Doctor.clinic_id == clinic.id).limit(1))).scalar_one_or_none()
        if not doctor:
            doctor = (await session.execute(select(Doctor).limit(1))).scalar_one()

        # 3. Get User for verification/billing
        admin_user = (await session.execute(select(User).limit(1))).scalar_one()

        # 4. Clean up any previous test patient with PT-10001
        old_patient = (await session.execute(select(Patient).where(Patient.patient_code == TEST_SERIAL_NO))).scalar_one_or_none()
        if old_patient:
            print(f"Cleaning existing test patient {TEST_SERIAL_NO}...")
            old_appts = (await session.execute(select(Appointment).where(Appointment.patient_id == old_patient.id))).scalars().all()
            for a in old_appts:
                await session.execute(delete(Prescription).where(Prescription.appointment_id == a.id))
                await session.execute(delete(Vitals).where(Vitals.appointment_id == a.id))
                await session.execute(delete(LabOrder).where(LabOrder.appointment_id == a.id))
                await session.execute(delete(Bill).where(Bill.appointment_id == a.id))
                await session.delete(a)
            await session.execute(delete(LabOrder).where(LabOrder.patient_id == old_patient.id))
            await session.execute(delete(Bill).where(Bill.patient_id == old_patient.id))
            await session.delete(old_patient)
            await session.commit()

        # 5. Create Fresh Patient
        patient = Patient(
            clinic_id=clinic.id,
            patient_code=TEST_SERIAL_NO,
            full_name=TEST_NAME,
            mobile=TEST_MOBILE,
            alt_mobile="9811122233",
            email="rajesh.verma@example.com",
            dob=date(1984, 5, 14),
            age=42,
            gender="male",
            blood_group="O+",
            address="Flat 402, Green Valley Apartments, MG Road, Bangalore",
            emergency_contact="+91 98765 00001",
            allergies="Penicillin, Sulfa drugs"
        )
        session.add(patient)
        await session.commit()
        await session.refresh(patient)
        print(f"✅ Created Patient: {patient.full_name} | Serial No: {patient.patient_code} | Mobile: {patient.mobile}")

        # 6. Create Completed Appointment
        appt = Appointment(
            clinic_id=clinic.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            department=doctor.department or "Cardiology",
            visit_type="new",
            appointment_date=date.today(),
            appointment_time=time(10, 30),
            token_number="A-101",
            queue_number=1,
            status="completed",
            booked_by=admin_user.id,
            checked_in_at=datetime.now(),
            completed_at=datetime.now(),
            notes="Routine Cardiac & Hypertension Health Checkup"
        )
        session.add(appt)
        await session.commit()
        await session.refresh(appt)

        # 7. Add Vitals
        vitals = Vitals(
            appointment_id=appt.id,
            blood_pressure="138/88",
            weight=76.5,
            height=174.0,
            bmi=25.3,
            temperature=98.4,
            notes="Mild systolic hypertension. Patient feels occasional fatigue."
        )
        session.add(vitals)

        # 8. Create Signed Prescription (Rx)
        prescription = Prescription(
            appointment_id=appt.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            notes="Advised low-sodium and low-cholesterol diet. Daily 30 mins brisk walking. Follow-up in 4 weeks with fresh lipid profile."
        )
        session.add(prescription)
        await session.commit()
        await session.refresh(prescription)

        medications = [
            {"name": "Telmisartan 40mg (Telma 40)", "dosage": "40mg", "frequency": "1-0-0", "duration_days": "30 days", "instructions": "Morning after breakfast for Blood Pressure"},
            {"name": "Atorvastatin 20mg (Atorva 20)", "dosage": "20mg", "frequency": "0-0-1", "duration_days": "30 days", "instructions": "Night after dinner for Cholesterol reduction"},
            {"name": "Metformin SR 500mg (Glycomet)", "dosage": "500mg", "frequency": "1-0-1", "duration_days": "30 days", "instructions": "Twice daily with meals for Fasting Blood Sugar"},
            {"name": "Pantoprazole 40mg (Pan 40)", "dosage": "40mg", "frequency": "1-0-0", "duration_days": "15 days", "instructions": "Empty stomach 30 mins before morning breakfast"},
        ]
        for med in medications:
            item = PrescriptionItem(
                prescription_id=prescription.id,
                medicine_name=med["name"],
                dosage=med["dosage"],
                frequency=med["frequency"],
                duration_days=med["duration_days"],
                instructions=med["instructions"]
            )
            session.add(item)
        print("✅ Added 4 Rx Medications to Prescription")

        # 9. Create Diagnostic Lab Test Catalog Items (if missing) & Verified Lab Results
        test_definitions = [
            {"name": "Lipid Profile - Total Cholesterol", "category": "Biochemistry", "price": 450.0, "unit": "mg/dL", "ref_min": 125.0, "ref_max": 200.0, "val": "235", "flag": "HIGH", "abnormal": True},
            {"name": "Lipid Profile - Serum Triglycerides", "category": "Biochemistry", "price": 350.0, "unit": "mg/dL", "ref_min": 50.0, "ref_max": 150.0, "val": "185", "flag": "HIGH", "abnormal": True},
            {"name": "Lipid Profile - HDL (Good) Cholesterol", "category": "Biochemistry", "price": 250.0, "unit": "mg/dL", "ref_min": 40.0, "ref_max": 60.0, "val": "44", "flag": "NORMAL", "abnormal": False},
            {"name": "Lipid Profile - LDL (Bad) Cholesterol", "category": "Biochemistry", "price": 300.0, "unit": "mg/dL", "ref_min": 50.0, "ref_max": 100.0, "val": "142", "flag": "HIGH", "abnormal": True},
            {"name": "Fasting Blood Glucose (FBS)", "category": "Biochemistry", "price": 150.0, "unit": "mg/dL", "ref_min": 70.0, "ref_max": 100.0, "val": "112", "flag": "HIGH", "abnormal": True},
            {"name": "Serum Creatinine (Kidney Function)", "category": "Biochemistry", "price": 200.0, "unit": "mg/dL", "ref_min": 0.6, "ref_max": 1.2, "val": "0.95", "flag": "NORMAL", "abnormal": False},
            {"name": "Hemoglobin (Hb)", "category": "Hematology", "price": 120.0, "unit": "g/dL", "ref_min": 13.0, "ref_max": 17.0, "val": "14.2", "flag": "NORMAL", "abnormal": False},
            {"name": "Total Leucocyte Count (TLC / WBC)", "category": "Hematology", "price": 150.0, "unit": "/uL", "ref_min": 4000.0, "ref_max": 11000.0, "val": "11500", "flag": "HIGH", "abnormal": True},
        ]

        lab_order = LabOrder(
            patient_id=patient.id,
            doctor_id=doctor.id,
            appointment_id=appt.id,
            status="completed"
        )
        session.add(lab_order)
        await session.commit()
        await session.refresh(lab_order)

        for td in test_definitions:
            catalog = (await session.execute(select(LabTestCatalog).where(LabTestCatalog.test_name == td["name"]))).scalar_one_or_none()
            if not catalog:
                catalog = LabTestCatalog(
                    clinic_id=clinic.id,
                    test_name=td["name"],
                    category=td["category"],
                    price=td["price"],
                    unit=td["unit"],
                    reference_range_min=td["ref_min"],
                    reference_range_max=td["ref_max"],
                    normal_range=f"{td['ref_min']} - {td['ref_max']} {td['unit']}"
                )
                session.add(catalog)
                await session.commit()
                await session.refresh(catalog)

            res = LabResult(
                order_id=lab_order.id,
                test_id=catalog.id,
                result_value=td["val"],
                unit=td["unit"],
                reference_range=f"{td['ref_min']} - {td['ref_max']} {td['unit']}",
                flag=td["flag"],
                is_abnormal=td["abnormal"],
                verified_by=admin_user.id,
                verified_at=datetime.now(),
                remarks=f"Verified automated analyzer reading on {datetime.now().strftime('%d-%b-%Y')}"
            )
            session.add(res)
        print("✅ Added 8 Verified Diagnostic Lab Test Results (with HIGH/NORMAL flags)")

        # 10. Create GST Tax Invoice & Payment Receipt
        subtotal = Decimal("2470.00")
        gst_amount = Decimal("444.60")
        total_amount = Decimal("2914.60")

        bill = Bill(
            clinic_id=clinic.id,
            patient_id=patient.id,
            appointment_id=appt.id,
            bill_number=f"INV-{datetime.now().strftime('%Y%m')}-1001",
            bill_type="consultation_and_lab",
            line_items=[
                {"description": "OPD Cardiology Consultation Fee (Dr. Meera Raghavan)", "quantity": 1, "unit_price": 500.0, "total": 500.0},
                {"description": "Comprehensive Cardiac Lipid Panel (Cholesterol, Triglycerides, HDL, LDL)", "quantity": 1, "unit_price": 1350.0, "total": 1350.0},
                {"description": "Fasting Blood Glucose & Serum Creatinine Tests", "quantity": 1, "unit_price": 350.0, "total": 350.0},
                {"description": "Complete Hemogram (Hb + TLC Count)", "quantity": 1, "unit_price": 270.0, "total": 270.0},
            ],
            subtotal=subtotal,
            discount_amount=Decimal("0.00"),
            cgst_amount=Decimal("222.30"),
            sgst_amount=Decimal("222.30"),
            gst_amount=gst_amount,
            total_amount=total_amount,
            payment_mode="UPI",
            payment_status="paid",
            created_by=admin_user.id,
            notes="Paid in full via Hospital Counter UPI QR Code"
        )
        session.add(bill)
        await session.commit()
        await session.refresh(bill)

        payment = Payment(
            bill_id=bill.id,
            amount=total_amount,
            mode="UPI",
            gateway_txn_id=f"UPI-{datetime.now().strftime('%Y%m%d%H%M%S')}-VERMA",
            status="success",
            paid_at=datetime.now()
        )
        session.add(payment)
        await session.commit()
        print(f"✅ Generated GST Tax Invoice: {bill.bill_number} for ₹{bill.total_amount}")

        print("\n🎉 =========================================================")
        print("🌟 TEST PATIENT DATA SEEDED & READY FOR TESTING!")
        print("=========================================================")
        print(f"👉 Patient Serial Number : {TEST_SERIAL_NO}")
        print(f"👉 Patient Mobile Number : {TEST_MOBILE}")
        print(f"👉 Patient Full Name     : {TEST_NAME}")
        print(f"👉 Doctor Consultation   : Dr. {doctor.first_name} {doctor.last_name} ({doctor.department})")
        print(f"👉 Verified Lab Tests    : 8 Parameters (Lipid Profile, FBS, Kidney & Blood Count)")
        print(f"👉 Prescriptions (Rx)    : 4 Medications with Schedules")
        print(f"👉 GST Invoice Number    : {bill.bill_number} (₹{total_amount} Paid via UPI)")
        print("=========================================================\n")

if __name__ == "__main__":
    asyncio.run(seed_demo_patient())
