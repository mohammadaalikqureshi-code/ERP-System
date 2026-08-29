"""Seed a working clinic so the system can be demonstrated and tested.

Run it with:

    python -m scripts.seed            # add anything missing
    python -m scripts.seed --reset    # wipe the demo data and rebuild it

What gets created:
  * roles and permissions (from `app/data/roles.py`)
  * a multi-specialty hospital with two branches, and a standalone clinic
  * staff for every role, with sign-in credentials printed at the end
  * doctors with weekly OPD schedules
  * the full laboratory catalogue and pharmacy stock (real reference data)
  * patients, today's appointment queue, consultations, prescriptions,
    lab orders with results, and bills

About the data: the **clinical** reference data is real — laboratory reference
ranges, generic drug names and strengths, ICD-10 codes and department names are
all genuine and safe to demonstrate to a doctor. The **institutions, staff and
patients are fictional**. No real hospital, doctor or patient is represented
here, which is deliberate: demo data that names a real hospital or a real
person can be mistaken for a real record.
"""

import asyncio
import random
import sys
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.data.clinical_reference import (
    COMMON_CONDITIONS,
    CONSUMABLES,
    EQUIPMENT,
    LAB_TESTS,
    MEDICINES,
    NOTIFICATION_TEMPLATES,
)
from app.data.roles import ROLES
from app.models.appointment import Appointment
from app.models.billing import Bill, Payment
from app.models.branch import Branch
from app.models.clinic import Clinic, ClinicSettings, Holiday
from app.models.doctor import Doctor, DoctorSchedule
from app.models.emr import MedicalHistory, Prescription, PrescriptionItem, Vitals
from app.models.inventory import InventoryItem
from app.models.lab import LabOrder, LabResult, LabTestCatalog
from app.models.audit import AuditLog
from app.models.notification import Notification, NotificationTemplate
from app.models.patient import Patient
from app.models.system import AiConversation, AiInsight, AiMessage, ApiKey, ClinicModule
from app.models.user import Role, User

# Everyone in the demo shares this password. It is printed at the end and is
# only ever used for seeded accounts.
DEMO_PASSWORD = "Medicare@2026"

# --------------------------------------------------------------------------
# The organisations. Fictional names, real Indian cities and address formats.
# --------------------------------------------------------------------------
CLINICS = [
    {
        "name": "Sanjeevani Multi-Specialty Hospital",
        "address": "Plot 14, Sector 12, Dwarka, New Delhi 110078",
        "phone": "01145678900",
        "email": "contact@sanjeevanihospital.in",
        "gst_number": "07AABCS1429B1ZX",
        "branches": [
            {
                "name": "Dwarka Main Campus",
                "address": "Plot 14, Sector 12, Dwarka, New Delhi 110078",
                "phone": "01145678900",
                "email": "dwarka@sanjeevanihospital.in",
                "is_main": True,
            },
            {
                "name": "Rohini Satellite OPD",
                "address": "C-8, Sector 9, Rohini, New Delhi 110085",
                "phone": "01145678911",
                "email": "rohini@sanjeevanihospital.in",
                "is_main": False,
            },
        ],
    },
    {
        "name": "Arogya Family Clinic",
        "address": "22 MG Road, Shivaji Nagar, Pune 411005",
        "phone": "02026781234",
        "email": "hello@arogyaclinic.in",
        "gst_number": "27AACCA9876C1ZP",
        "branches": [
            {
                "name": "Shivaji Nagar Clinic",
                "address": "22 MG Road, Shivaji Nagar, Pune 411005",
                "phone": "02026781234",
                "email": "shivajinagar@arogyaclinic.in",
                "is_main": True,
            }
        ],
    },
]

# --------------------------------------------------------------------------
# Staff. Fictional people; the qualifications and departments are realistic.
# --------------------------------------------------------------------------
DOCTORS = [
    {
        "name": "Dr. Meera Raghavan",
        "email": "meera.raghavan@sanjeevanihospital.in",
        "phone": "9810012001",
        "specialization": "Interventional Cardiology",
        "department": "Cardiology",
        "qualification": "MBBS, MD (Medicine), DM (Cardiology)",
        "fee": 900,
        "minutes": 20,
    },
    {
        "name": "Dr. Arjun Deshmukh",
        "email": "arjun.deshmukh@sanjeevanihospital.in",
        "phone": "9810012002",
        "specialization": "General Medicine & Diabetology",
        "department": "General Medicine",
        "qualification": "MBBS, MD (General Medicine)",
        "fee": 600,
        "minutes": 15,
    },
    {
        "name": "Dr. Fatima Sheikh",
        "email": "fatima.sheikh@sanjeevanihospital.in",
        "phone": "9810012003",
        "specialization": "Paediatrics & Neonatology",
        "department": "Paediatrics",
        "qualification": "MBBS, MD (Paediatrics)",
        "fee": 650,
        "minutes": 15,
    },
    {
        "name": "Dr. Vikram Nair",
        "email": "vikram.nair@sanjeevanihospital.in",
        "phone": "9810012004",
        "specialization": "Joint Replacement & Sports Injury",
        "department": "Orthopaedics",
        "qualification": "MBBS, MS (Orthopaedics)",
        "fee": 800,
        "minutes": 20,
    },
    {
        "name": "Dr. Ananya Bose",
        "email": "ananya.bose@sanjeevanihospital.in",
        "phone": "9810012005",
        "specialization": "Clinical & Cosmetic Dermatology",
        "department": "Dermatology",
        "qualification": "MBBS, MD (Dermatology)",
        "fee": 700,
        "minutes": 15,
    },
    {
        "name": "Dr. Rohit Malhotra",
        "email": "rohit.malhotra@sanjeevanihospital.in",
        "phone": "9810012006",
        "specialization": "Obstetrics & Gynaecology",
        "department": "Obstetrics & Gynaecology",
        "qualification": "MBBS, MS (Obstetrics & Gynaecology)",
        "fee": 750,
        "minutes": 20,
    },
]

STAFF = [
    {"name": "Priya Menon", "email": "priya.menon@sanjeevanihospital.in", "phone": "9810013001", "role": "receptionist"},
    {"name": "Sunita Yadav", "email": "sunita.yadav@sanjeevanihospital.in", "phone": "9810013002", "role": "nurse"},
    {"name": "Rakesh Kumar", "email": "rakesh.kumar@sanjeevanihospital.in", "phone": "9810013003", "role": "lab_staff"},
    {"name": "Imran Qureshi", "email": "imran.qureshi@sanjeevanihospital.in", "phone": "9810013004", "role": "pharmacist"},
    {"name": "Neha Kulkarni", "email": "neha.kulkarni@sanjeevanihospital.in", "phone": "9810013005", "role": "clinic_admin"},
]

# Fictional patients with realistic Indian names and demographics.
PATIENTS = [
    ("Ramesh Chandra Gupta", "9811100001", "male", 58, "B+", "Sulfa drugs"),
    ("Lakshmi Narayanan", "9811100002", "female", 34, "O+", None),
    ("Mohammed Irfan Ali", "9811100003", "male", 45, "A+", "Penicillin"),
    ("Anjali Sharma", "9811100004", "female", 29, "AB+", None),
    ("Gurpreet Singh Bedi", "9811100005", "male", 62, "O-", None),
    ("Kavitha Reddy", "9811100006", "female", 41, "B+", "Aspirin"),
    ("Sanjay Patil", "9811100007", "male", 37, "A-", None),
    ("Farida Begum", "9811100008", "female", 67, "O+", "Iodine contrast"),
    ("Aditya Verma", "9811100009", "male", 8, "B+", None),
    ("Meenakshi Iyer", "9811100010", "female", 52, "A+", None),
    ("Harpreet Kaur", "9811100011", "female", 31, "AB-", None),
    ("Suresh Babu", "9811100012", "male", 49, "O+", None),
]


async def reset_demo_data(db) -> None:
    """Delete the demo data so the seed can be re-run from clean.

    Order matters: children before parents, because these tables have real
    foreign keys. Roles are kept — they are configuration, not demo data.
    """
    print("[*] Clearing existing demo data...")

    # Records that point at users, clinics or patients.
    for model in (
        AiMessage, AiConversation, AiInsight, ApiKey,
        Payment, Bill, LabResult, LabOrder, PrescriptionItem, Prescription,
        Vitals, MedicalHistory, Appointment, Notification, AuditLog,
        Patient, DoctorSchedule, Doctor, InventoryItem, LabTestCatalog,
        ClinicModule, Holiday, ClinicSettings,
    ):
        await db.execute(delete(model))

    # Every user that belongs to a clinic, plus the platform administrator.
    # This includes portal accounts created for patients during testing.
    await db.execute(delete(User).where(User.clinic_id.isnot(None)))
    await db.execute(delete(User).where(User.email == "admin@medicare-erp.in"))

    await db.execute(delete(Branch))
    await db.execute(delete(Clinic))
    await db.commit()


async def seed_roles(db) -> dict:
    print("[*] Roles and permissions...")
    role_map = {}
    for name, definition in ROLES.items():
        role = (await db.execute(select(Role).where(Role.name == name))).scalar_one_or_none()
        if role:
            role.permissions = definition["permissions"]
            role.description = definition["description"]
        else:
            role = Role(
                name=name,
                permissions=definition["permissions"],
                description=definition["description"],
            )
            db.add(role)
            await db.flush()
        role_map[name] = role
    await db.commit()
    return role_map


async def seed_clinics(db) -> list:
    print("[*] Clinics and branches...")
    created = []

    for definition in CLINICS:
        clinic = (
            await db.execute(select(Clinic).where(Clinic.name == definition["name"]))
        ).scalar_one_or_none()

        if not clinic:
            clinic = Clinic(
                name=definition["name"],
                address=definition["address"],
                phone=definition["phone"],
                email=definition["email"],
                gst_number=definition["gst_number"],
                timezone="Asia/Kolkata",
                currency="INR",
                language="en",
                working_days=[0, 1, 2, 3, 4, 5],  # Monday to Saturday
                is_active=True,
            )
            db.add(clinic)
            await db.flush()

            db.add(ClinicSettings(clinic_id=clinic.id, gst_rate=18.0, session_timeout_minutes=30))

            # A few real public holidays, so scheduling can be demonstrated.
            for holiday_date, description in [
                (date(date.today().year, 1, 26), "Republic Day"),
                (date(date.today().year, 8, 15), "Independence Day"),
                (date(date.today().year, 10, 2), "Gandhi Jayanti"),
            ]:
                db.add(Holiday(clinic_id=clinic.id, date=holiday_date, description=description))

            for branch in definition["branches"]:
                db.add(
                    Branch(
                        clinic_id=clinic.id,
                        name=branch["name"],
                        address=branch["address"],
                        phone=branch["phone"],
                        email=branch["email"],
                        is_main_branch=branch["is_main"],
                        is_active=True,
                    )
                )

        created.append(clinic)

    await db.commit()
    return created


async def seed_panels(db, clinic) -> None:
    """Turn on the panels this clinic uses. AI stays off until a key is added."""
    print("[*] Panel configuration...")
    for module_key, enabled in [
        ("reception", True),
        ("doctor", True),
        ("lab", True),
        ("inventory", True),
        ("patient_portal", True),
        ("queue_display", True),
        ("reports", True),
        ("ai_assistant", False),
        ("notifications", False),
    ]:
        exists = (
            await db.execute(
                select(ClinicModule).where(
                    ClinicModule.clinic_id == clinic.id, ClinicModule.module_key == module_key
                )
            )
        ).scalar_one_or_none()
        if not exists:
            db.add(ClinicModule(clinic_id=clinic.id, module_key=module_key, is_enabled=enabled, config={}))
    await db.commit()


async def seed_users(db, clinic, role_map) -> dict:
    print("[*] Staff accounts...")
    password_hash = get_password_hash(DEMO_PASSWORD)
    people = {}

    async def upsert_user(full_name, email, phone, role_name, clinic_id):
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not user:
            user = User(
                clinic_id=clinic_id,
                role_id=role_map[role_name].id,
                full_name=full_name,
                email=email,
                phone=phone,
                password_hash=password_hash,
                is_active=True,
            )
            db.add(user)
            await db.flush()
        return user

    people["super_admin"] = await upsert_user(
        "Platform Administrator", "admin@medicare-erp.in", "9810010000", "super_admin", None
    )
    await upsert_user("Platform Administrator", "admin@medicare.com", "9810010001", "super_admin", None)
    await upsert_user("Platform Administrator", "superadmin@medicare.com", "9810010002", "super_admin", None)
    await upsert_user("Platform Administrator", "superadmin@medicare-erp.in", "9810010003", "super_admin", None)

    for member in STAFF:
        people[member["role"]] = await upsert_user(
            member["name"], member["email"], member["phone"], member["role"], clinic.id
        )

    people["doctors"] = []
    for definition in DOCTORS:
        user = await upsert_user(
            definition["name"], definition["email"], definition["phone"], "doctor", clinic.id
        )

        doctor = (
            await db.execute(select(Doctor).where(Doctor.user_id == user.id))
        ).scalar_one_or_none()

        if not doctor:
            doctor = Doctor(
                user_id=user.id,
                clinic_id=clinic.id,
                specialization=definition["specialization"],
                department=definition["department"],
                qualification=definition["qualification"],
                consultation_fee=Decimal(str(definition["fee"])),
                avg_consultation_minutes=definition["minutes"],
                is_available=True,
            )
            db.add(doctor)
            await db.flush()

            # Monday to Saturday OPD, with a lunch break.
            for day in range(0, 6):
                db.add(
                    DoctorSchedule(
                        doctor_id=doctor.id,
                        day_of_week=day,
                        start_time=time(9, 0),
                        end_time=time(17, 0),
                        slot_duration_minutes=definition["minutes"],
                        break_start=time(13, 0),
                        break_end=time(14, 0),
                    )
                )

        people["doctors"].append(doctor)

    await db.commit()
    return people


async def seed_catalogues(db, clinic) -> list:
    print("[*] Laboratory catalogue and pharmacy stock...")

    tests = []
    for definition in LAB_TESTS:
        test = (
            await db.execute(
                select(LabTestCatalog).where(
                    LabTestCatalog.clinic_id == clinic.id,
                    LabTestCatalog.test_name == definition["name"],
                )
            )
        ).scalar_one_or_none()

        if not test:
            reference = definition["range"]
            if reference and definition["unit"] not in ("panel", "report", "qualitative"):
                reference = f"{reference} {definition['unit']}"

            test = LabTestCatalog(
                clinic_id=clinic.id,
                test_name=definition["name"],
                category=definition["category"],
                price=float(definition["price"]),
                normal_range=reference or None,
            )
            db.add(test)
            await db.flush()
        tests.append(test)

    for definition in MEDICINES + CONSUMABLES + EQUIPMENT:
        item = (
            await db.execute(
                select(InventoryItem).where(
                    InventoryItem.clinic_id == clinic.id, InventoryItem.name == definition["name"]
                )
            )
        ).scalar_one_or_none()

        if not item:
            # A couple of items start below their reorder level so the low-stock
            # alerts have something real to show.
            stock = random.randint(int(definition["reorder"] * 1.5), int(definition["reorder"] * 4))
            if definition["name"] in (
                "Azithromycin 500 mg Tablet",
                "IV Cannula 20G",
                "Salbutamol Inhaler 100 mcg",
            ):
                stock = max(1, int(definition["reorder"] * 0.4))

            db.add(
                InventoryItem(
                    clinic_id=clinic.id,
                    name=definition["name"],
                    type=definition["type"],
                    stock_quantity=stock,
                    unit_price=Decimal(str(definition["price"])),
                    reorder_level=definition["reorder"],
                    expiry_date=(
                        datetime.now(timezone.utc) + timedelta(days=random.randint(120, 900))
                        if definition["type"] == "medicine"
                        else None
                    ),
                )
            )

    for template in NOTIFICATION_TEMPLATES:
        exists = (
            await db.execute(
                select(NotificationTemplate).where(NotificationTemplate.code == template["code"])
            )
        ).scalar_one_or_none()
        if not exists:
            db.add(
                NotificationTemplate(
                    code=template["code"],
                    channel=template["channel"],
                    body_template=template["body"],
                    is_active=True,
                )
            )

    await db.commit()
    return tests


async def seed_patients(db, clinic) -> list:
    print("[*] Patients...")
    patients = []

    for index, (name, mobile, gender, age, blood_group, allergies) in enumerate(PATIENTS, start=1):
        patient = (
            await db.execute(
                select(Patient).where(Patient.clinic_id == clinic.id, Patient.mobile == mobile)
            )
        ).scalar_one_or_none()

        if not patient:
            patient = Patient(
                clinic_id=clinic.id,
                patient_code=f"PT-{index:05d}",
                full_name=name,
                mobile=mobile,
                email=f"{name.split()[0].lower()}{index}@example.in",
                dob=date.today() - timedelta(days=age * 365 + random.randint(0, 300)),
                age=age,
                gender=gender,
                blood_group=blood_group,
                address=f"{random.randint(1, 250)}, Sector {random.randint(1, 25)}, New Delhi",
                emergency_contact=f"98111{random.randint(10000, 99999)}",
                allergies=allergies,
            )
            db.add(patient)
            await db.flush()

            # Give roughly half the patients a documented condition.
            if index % 2 == 0:
                condition = COMMON_CONDITIONS[index % len(COMMON_CONDITIONS)]
                db.add(
                    MedicalHistory(
                        patient_id=patient.id,
                        condition=f"{condition['condition']} ({condition['icd10']})",
                        diagnosed_date=date.today() - timedelta(days=random.randint(200, 2000)),
                        status=condition["status"],
                        notes="Recorded at registration from the patient's own account.",
                    )
                )

        patients.append(patient)

    await db.commit()
    return patients


async def seed_appointments(db, clinic, people, patients, tests) -> None:
    """Build today's queue plus a fortnight of history for the reports."""
    print("[*] Appointments, consultations, lab orders and bills...")

    doctors = people["doctors"]
    booked_by = people["receptionist"].id
    today = date.today()

    existing = (
        await db.execute(
            select(Appointment).where(
                Appointment.clinic_id == clinic.id, Appointment.appointment_date == today
            )
        )
    ).scalars().first()
    if existing:
        print("    already present - skipping")
        return

    # --- today's live queue -------------------------------------------------
    # A realistic mix: some finished, one in the room, the rest waiting.
    todays_states = [
        ("completed", time(9, 0)),
        ("completed", time(9, 20)),
        ("completed", time(9, 40)),
        ("in_consultation", time(10, 0)),
        ("checked_in", time(10, 20)),
        ("checked_in", time(10, 40)),
        ("booked", time(11, 0)),
        ("booked", time(11, 20)),
        ("booked", time(11, 40)),
        ("no_show", time(12, 0)),
    ]

    tokens_today: dict = {}
    for index, (status, slot) in enumerate(todays_states):
        doctor = doctors[index % len(doctors)]
        patient = patients[index % len(patients)]

        tokens_today[doctor.id] = tokens_today.get(doctor.id, 0) + 1
        queue_number = tokens_today[doctor.id]

        appointment = Appointment(
            clinic_id=clinic.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            department=doctor.department,
            visit_type="follow_up" if index % 3 == 0 else "new",
            appointment_date=today,
            appointment_time=slot,
            token_number=f"A-{queue_number:03d}",
            queue_number=queue_number,
            status=status,
            notes=random.choice(
                [
                    "Fever and body ache for 3 days",
                    "Routine diabetes review",
                    "Persistent dry cough for two weeks",
                    "Follow-up after blood tests",
                    "Knee pain while climbing stairs",
                    "Skin rash on both forearms",
                ]
            ),
            booked_by=booked_by,
            checked_in_at=datetime.now(timezone.utc) if status != "booked" else None,
            completed_at=datetime.now(timezone.utc) if status == "completed" else None,
        )
        db.add(appointment)
        await db.flush()

        if status != "completed":
            continue

        # A completed visit has vitals, a prescription and a bill.
        db.add(
            Vitals(
                appointment_id=appointment.id,
                blood_pressure=f"{random.randint(110, 145)}/{random.randint(70, 95)}",
                weight=round(random.uniform(48, 92), 1),
                height=round(random.uniform(150, 182), 1),
                bmi=round(random.uniform(19, 31), 1),
                temperature=round(random.uniform(97.2, 101.4), 1),
                notes="Patient alert and oriented. Chest clear on auscultation.",
            )
        )

        prescription = Prescription(
            appointment_id=appointment.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            notes="Take medicines after food. Return in one week if symptoms persist.",
        )
        db.add(prescription)
        await db.flush()

        for medicine in random.sample(MEDICINES[:12], k=random.randint(2, 3)):
            parts = medicine["name"].split()
            db.add(
                PrescriptionItem(
                    prescription_id=prescription.id,
                    medicine_name=medicine["name"],
                    dosage=" ".join(parts[1:3]) if len(parts) > 2 else parts[-1],
                    frequency=random.choice(["1-0-1", "1-1-1", "0-0-1", "1-0-0"]),
                    duration_days=random.choice(["3 days", "5 days", "7 days", "10 days"]),
                    instructions=random.choice(["After food", "Before food", "At bedtime"]),
                )
            )

        # Roughly every other completed visit also orders tests.
        if index % 2 == 0:
            order = LabOrder(
                patient_id=patient.id,
                doctor_id=doctor.id,
                appointment_id=appointment.id,
                status="completed",
            )
            db.add(order)
            await db.flush()

            for test in random.sample([t for t in tests if t.normal_range], k=3):
                # Produce a value inside the range most of the time, and
                # deliberately outside it sometimes, so flagging is visible.
                bounds = test.normal_range.split() if test.normal_range else []
                try:
                    low, high = float(bounds[0]), float(bounds[2])
                    if random.random() < 0.25:
                        value = round(high * random.uniform(1.1, 1.6), 1)
                    else:
                        value = round(random.uniform(low, high), 1)
                except (IndexError, ValueError):
                    value = "Normal"

                db.add(LabResult(order_id=order.id, test_id=test.id, result_value=str(value)))

        consultation_fee = Decimal(str(doctor.consultation_fee))
        gst = (consultation_fee * Decimal("0.18")).quantize(Decimal("0.01"))
        bill = Bill(
            clinic_id=clinic.id,
            patient_id=patient.id,
            appointment_id=appointment.id,
            bill_number=f"INV-{today:%Y%m}-{queue_number:04d}",
            bill_type="consultation",
            line_items=[
                {
                    "description": f"Consultation - {doctor.department}",
                    "quantity": 1,
                    "unit_price": float(consultation_fee),
                    "amount": float(consultation_fee),
                }
            ],
            subtotal=consultation_fee,
            discount_amount=Decimal("0"),
            gst_amount=gst,
            total_amount=consultation_fee + gst,
            payment_mode=random.choice(["cash", "upi", "card"]),
            payment_status="paid",
            created_by=booked_by,
        )
        db.add(bill)
        await db.flush()
        db.add(
            Payment(
                bill_id=bill.id,
                amount=bill.total_amount,
                mode=bill.payment_mode,
                status="success",
                paid_at=datetime.now(timezone.utc),
            )
        )

    # --- two weeks of history, so the charts have something to plot ---------
    for days_ago in range(1, 15):
        day = today - timedelta(days=days_ago)
        if day.weekday() == 6:  # clinic closed on Sundays
            continue

        # Token numbers are unique per doctor per day, so count them that way
        # rather than by position in the loop.
        tokens_issued: dict = {}

        for slot_index in range(random.randint(6, 14)):
            doctor = random.choice(doctors)
            patient = random.choice(patients)
            status = random.choices(
                ["completed", "cancelled", "no_show"], weights=[85, 8, 7], k=1
            )[0]

            tokens_issued[doctor.id] = tokens_issued.get(doctor.id, 0) + 1
            queue_number = tokens_issued[doctor.id]

            appointment = Appointment(
                clinic_id=clinic.id,
                patient_id=patient.id,
                doctor_id=doctor.id,
                department=doctor.department,
                visit_type=random.choice(["new", "follow_up"]),
                appointment_date=day,
                appointment_time=time(9 + slot_index % 8, (slot_index % 3) * 20),
                token_number=f"A-{queue_number:03d}",
                queue_number=queue_number,
                status=status,
                booked_by=booked_by,
                completed_at=(
                    datetime.combine(day, time(12, 0)).replace(tzinfo=timezone.utc)
                    if status == "completed"
                    else None
                ),
            )
            db.add(appointment)
            await db.flush()

            if status != "completed":
                continue

            fee = Decimal(str(doctor.consultation_fee))
            gst = (fee * Decimal("0.18")).quantize(Decimal("0.01"))
            paid_at = datetime.combine(day, time(12, 0)).replace(tzinfo=timezone.utc)
            mode = random.choice(["cash", "upi", "card"])

            bill = Bill(
                clinic_id=clinic.id,
                patient_id=patient.id,
                appointment_id=appointment.id,
                bill_number=f"INV-{day:%Y%m}-{days_ago:02d}{slot_index:02d}",
                bill_type="consultation",
                line_items=[
                    {
                        "description": f"Consultation - {doctor.department}",
                        "quantity": 1,
                        "unit_price": float(fee),
                        "amount": float(fee),
                    }
                ],
                subtotal=fee,
                discount_amount=Decimal("0"),
                gst_amount=gst,
                total_amount=fee + gst,
                payment_mode=mode,
                payment_status="paid",
                created_by=booked_by,
                created_at=paid_at,
            )
            db.add(bill)
            await db.flush()

            # The revenue report reads payments, not bills, so a paid bill
            # needs its payment row or the charts come out empty.
            db.add(
                Payment(
                    bill_id=bill.id,
                    amount=bill.total_amount,
                    mode=mode,
                    status="success",
                    paid_at=paid_at,
                )
            )

    await db.commit()


def print_credentials() -> None:
    print("\n" + "=" * 68)
    print("  Demo sign-in details")
    print("=" * 68)
    print(f"  Password for every account below: {DEMO_PASSWORD}\n")
    rows = [
        ("Super admin", "admin@medicare-erp.in"),
        ("Clinic admin", "neha.kulkarni@sanjeevanihospital.in"),
        ("Doctor (Cardiology)", "meera.raghavan@sanjeevanihospital.in"),
        ("Doctor (Gen. Medicine)", "arjun.deshmukh@sanjeevanihospital.in"),
        ("Receptionist", "priya.menon@sanjeevanihospital.in"),
        ("Nurse", "sunita.yadav@sanjeevanihospital.in"),
        ("Lab technician", "rakesh.kumar@sanjeevanihospital.in"),
        ("Pharmacist", "imran.qureshi@sanjeevanihospital.in"),
    ]
    for label, email in rows:
        print(f"  {label:<24} {email}")
    print("\n  Patient portal: sign in with mobile 9811100001 and the OTP shown")
    print("  in the API response (development mode only).")
    print("=" * 68 + "\n")


async def create_tables():
    """Create all database tables if they don't exist (for fresh deployments)."""
    from app.models.base import Base
    from app.core.database import engine
    # Import all models so they are registered with Base.metadata
    import app.models.user
    import app.models.clinic
    import app.models.branch
    import app.models.patient
    import app.models.appointment
    import app.models.doctor
    import app.models.emr
    import app.models.lab
    import app.models.billing
    import app.models.inventory
    import app.models.audit
    import app.models.notification
    import app.models.system

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Database tables created / verified.")


async def main() -> None:
    try:
        # Create tables first (idempotent — safe on existing databases)
        await create_tables()

        should_reset = "--reset" in sys.argv

        async with AsyncSessionLocal() as db:
            if should_reset:
                await reset_demo_data(db)

            role_map = await seed_roles(db)
            clinics = await seed_clinics(db)
            primary = clinics[0]

            await seed_panels(db, primary)
            people = await seed_users(db, primary, role_map)
            tests = await seed_catalogues(db, primary)
            patients = await seed_patients(db, primary)
            await seed_appointments(db, primary, people, patients, tests)

        print("\n[OK] Seeding complete.")
        print_credentials()
    except Exception as e:
        print(f"\n[WARNING] Database seeding deferred: {e}")
        print("💡 TIP: Verify that your Render DATABASE_URL is the full connection URL: postgresql://user:password@host/dbname")


if __name__ == "__main__":
    asyncio.run(main())
