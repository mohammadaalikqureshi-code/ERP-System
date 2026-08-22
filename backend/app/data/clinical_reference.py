"""Real clinical reference data used to set up a new clinic.

Everything in this file is genuine, checkable clinical information — adult
reference ranges as reported by Indian diagnostic laboratories, generic drug
names with the strengths they are actually dispensed in, and the standard
department list of a multi-specialty hospital. Prices are typical Indian
private-clinic rates in rupees and are meant to be edited per clinic.

The reference ranges are used two ways: printed on lab reports, and compared
against entered values to flag abnormal results. Ranges written as "low - high"
are parsed automatically; qualitative tests carry a descriptive range instead
and are never auto-flagged.
"""

from typing import Dict, List

# --------------------------------------------------------------------------
# Departments of a multi-specialty hospital
# --------------------------------------------------------------------------
DEPARTMENTS: List[str] = [
    "General Medicine",
    "General Surgery",
    "Cardiology",
    "Orthopaedics",
    "Paediatrics",
    "Obstetrics & Gynaecology",
    "Dermatology",
    "ENT",
    "Ophthalmology",
    "Dentistry",
    "Neurology",
    "Gastroenterology",
    "Pulmonology",
    "Endocrinology",
    "Nephrology",
    "Urology",
    "Psychiatry",
    "Physiotherapy",
]

# --------------------------------------------------------------------------
# Laboratory catalogue
# name, category, price (INR), reference range, unit
# --------------------------------------------------------------------------
LAB_TESTS: List[Dict] = [
    # --- Haematology ------------------------------------------------------
    {"name": "Complete Blood Count (CBC)", "category": "Haematology", "price": 350, "range": "", "unit": "panel"},
    {"name": "Haemoglobin (Hb)", "category": "Haematology", "price": 120, "range": "13.0 - 17.0", "unit": "g/dL"},
    {"name": "Total Leukocyte Count (TLC)", "category": "Haematology", "price": 150, "range": "4000 - 11000", "unit": "cells/µL"},
    {"name": "Platelet Count", "category": "Haematology", "price": 150, "range": "150000 - 450000", "unit": "cells/µL"},
    {"name": "Packed Cell Volume (PCV)", "category": "Haematology", "price": 130, "range": "40 - 50", "unit": "%"},
    {"name": "Mean Corpuscular Volume (MCV)", "category": "Haematology", "price": 130, "range": "80 - 100", "unit": "fL"},
    {"name": "ESR", "category": "Haematology", "price": 100, "range": "0 - 15", "unit": "mm/hr"},
    {"name": "Peripheral Blood Smear", "category": "Haematology", "price": 250, "range": "Normal study", "unit": "report"},
    # --- Biochemistry -----------------------------------------------------
    {"name": "Fasting Blood Sugar (FBS)", "category": "Biochemistry", "price": 90, "range": "70 - 100", "unit": "mg/dL"},
    {"name": "Post Prandial Blood Sugar (PPBS)", "category": "Biochemistry", "price": 90, "range": "70 - 140", "unit": "mg/dL"},
    {"name": "HbA1c (Glycated Haemoglobin)", "category": "Biochemistry", "price": 550, "range": "4.0 - 5.6", "unit": "%"},
    {"name": "Serum Creatinine", "category": "Biochemistry", "price": 150, "range": "0.7 - 1.3", "unit": "mg/dL"},
    {"name": "Blood Urea", "category": "Biochemistry", "price": 150, "range": "15 - 40", "unit": "mg/dL"},
    {"name": "Uric Acid", "category": "Biochemistry", "price": 180, "range": "3.5 - 7.2", "unit": "mg/dL"},
    {"name": "Total Cholesterol", "category": "Biochemistry", "price": 200, "range": "125 - 200", "unit": "mg/dL"},
    {"name": "Triglycerides", "category": "Biochemistry", "price": 200, "range": "50 - 150", "unit": "mg/dL"},
    {"name": "HDL Cholesterol", "category": "Biochemistry", "price": 200, "range": "40 - 60", "unit": "mg/dL"},
    {"name": "LDL Cholesterol", "category": "Biochemistry", "price": 200, "range": "50 - 100", "unit": "mg/dL"},
    {"name": "SGPT (ALT)", "category": "Biochemistry", "price": 160, "range": "7 - 56", "unit": "U/L"},
    {"name": "SGOT (AST)", "category": "Biochemistry", "price": 160, "range": "8 - 48", "unit": "U/L"},
    {"name": "Serum Bilirubin (Total)", "category": "Biochemistry", "price": 160, "range": "0.3 - 1.2", "unit": "mg/dL"},
    {"name": "Alkaline Phosphatase (ALP)", "category": "Biochemistry", "price": 180, "range": "44 - 147", "unit": "U/L"},
    {"name": "Total Protein", "category": "Biochemistry", "price": 160, "range": "6.0 - 8.3", "unit": "g/dL"},
    {"name": "Serum Albumin", "category": "Biochemistry", "price": 160, "range": "3.5 - 5.5", "unit": "g/dL"},
    {"name": "Serum Sodium", "category": "Biochemistry", "price": 180, "range": "135 - 145", "unit": "mEq/L"},
    {"name": "Serum Potassium", "category": "Biochemistry", "price": 180, "range": "3.5 - 5.1", "unit": "mEq/L"},
    {"name": "Serum Calcium", "category": "Biochemistry", "price": 200, "range": "8.5 - 10.2", "unit": "mg/dL"},
    # --- Endocrinology ----------------------------------------------------
    {"name": "TSH (Thyroid Stimulating Hormone)", "category": "Endocrinology", "price": 350, "range": "0.4 - 4.0", "unit": "µIU/mL"},
    {"name": "Free T3", "category": "Endocrinology", "price": 400, "range": "2.3 - 4.2", "unit": "pg/mL"},
    {"name": "Free T4", "category": "Endocrinology", "price": 400, "range": "0.8 - 1.8", "unit": "ng/dL"},
    {"name": "Vitamin D (25-OH)", "category": "Endocrinology", "price": 1200, "range": "30 - 100", "unit": "ng/mL"},
    {"name": "Vitamin B12", "category": "Endocrinology", "price": 900, "range": "200 - 900", "unit": "pg/mL"},
    # --- Serology & Microbiology -----------------------------------------
    {"name": "C-Reactive Protein (CRP)", "category": "Serology", "price": 450, "range": "0 - 6", "unit": "mg/L"},
    {"name": "Dengue NS1 Antigen", "category": "Serology", "price": 800, "range": "Non-reactive", "unit": "qualitative"},
    {"name": "Widal Test", "category": "Serology", "price": 300, "range": "Non-reactive", "unit": "qualitative"},
    {"name": "Malaria Antigen", "category": "Microbiology", "price": 350, "range": "Not detected", "unit": "qualitative"},
    {"name": "Urine Routine & Microscopy", "category": "Microbiology", "price": 200, "range": "Normal study", "unit": "report"},
    {"name": "Urine Culture & Sensitivity", "category": "Microbiology", "price": 600, "range": "No growth", "unit": "report"},
    # --- Pathology --------------------------------------------------------
    {"name": "Blood Group & Rh Typing", "category": "Pathology", "price": 150, "range": "", "unit": "report"},
    {"name": "Thyroid Profile (T3, T4, TSH)", "category": "Pathology", "price": 700, "range": "", "unit": "panel"},
    {"name": "Lipid Profile", "category": "Pathology", "price": 700, "range": "", "unit": "panel"},
    {"name": "Liver Function Test (LFT)", "category": "Pathology", "price": 750, "range": "", "unit": "panel"},
    {"name": "Kidney Function Test (KFT)", "category": "Pathology", "price": 750, "range": "", "unit": "panel"},
]

# --------------------------------------------------------------------------
# Pharmacy catalogue — generic names and the strengths actually dispensed
# --------------------------------------------------------------------------
MEDICINES: List[Dict] = [
    {"name": "Paracetamol 500 mg Tablet", "type": "medicine", "price": 1.50, "unit": "tablet", "reorder": 500},
    {"name": "Ibuprofen 400 mg Tablet", "type": "medicine", "price": 2.20, "unit": "tablet", "reorder": 300},
    {"name": "Diclofenac 50 mg Tablet", "type": "medicine", "price": 2.50, "unit": "tablet", "reorder": 200},
    {"name": "Amoxicillin 500 mg Capsule", "type": "medicine", "price": 8.50, "unit": "capsule", "reorder": 300},
    {"name": "Azithromycin 500 mg Tablet", "type": "medicine", "price": 22.00, "unit": "tablet", "reorder": 150},
    {"name": "Cefixime 200 mg Tablet", "type": "medicine", "price": 14.00, "unit": "tablet", "reorder": 200},
    {"name": "Metronidazole 400 mg Tablet", "type": "medicine", "price": 3.20, "unit": "tablet", "reorder": 200},
    {"name": "Ceftriaxone 1 g Injection", "type": "medicine", "price": 55.00, "unit": "vial", "reorder": 50},
    {"name": "Pantoprazole 40 mg Tablet", "type": "medicine", "price": 5.50, "unit": "tablet", "reorder": 300},
    {"name": "Omeprazole 20 mg Capsule", "type": "medicine", "price": 4.20, "unit": "capsule", "reorder": 300},
    {"name": "Ondansetron 4 mg Tablet", "type": "medicine", "price": 6.00, "unit": "tablet", "reorder": 150},
    {"name": "Cetirizine 10 mg Tablet", "type": "medicine", "price": 1.80, "unit": "tablet", "reorder": 300},
    {"name": "Montelukast 10 mg Tablet", "type": "medicine", "price": 9.50, "unit": "tablet", "reorder": 150},
    {"name": "Salbutamol Inhaler 100 mcg", "type": "medicine", "price": 145.00, "unit": "inhaler", "reorder": 25},
    {"name": "Metformin 500 mg Tablet", "type": "medicine", "price": 2.80, "unit": "tablet", "reorder": 400},
    {"name": "Glimepiride 2 mg Tablet", "type": "medicine", "price": 5.20, "unit": "tablet", "reorder": 200},
    {"name": "Insulin Glargine 100 IU/mL", "type": "medicine", "price": 780.00, "unit": "pen", "reorder": 15},
    {"name": "Amlodipine 5 mg Tablet", "type": "medicine", "price": 2.40, "unit": "tablet", "reorder": 300},
    {"name": "Telmisartan 40 mg Tablet", "type": "medicine", "price": 6.80, "unit": "tablet", "reorder": 250},
    {"name": "Losartan 50 mg Tablet", "type": "medicine", "price": 5.40, "unit": "tablet", "reorder": 250},
    {"name": "Atorvastatin 10 mg Tablet", "type": "medicine", "price": 6.20, "unit": "tablet", "reorder": 250},
    {"name": "Levothyroxine 50 mcg Tablet", "type": "medicine", "price": 3.10, "unit": "tablet", "reorder": 300},
    {"name": "Iron & Folic Acid Tablet", "type": "medicine", "price": 2.00, "unit": "tablet", "reorder": 400},
    {"name": "Calcium + Vitamin D3 Tablet", "type": "medicine", "price": 4.50, "unit": "tablet", "reorder": 300},
    {"name": "ORS Sachet (WHO formula)", "type": "medicine", "price": 12.00, "unit": "sachet", "reorder": 200},
]

CONSUMABLES: List[Dict] = [
    {"name": "Disposable Syringe 5 mL", "type": "consumable", "price": 6.00, "unit": "piece", "reorder": 300},
    {"name": "Examination Gloves (Latex, M)", "type": "consumable", "price": 9.00, "unit": "pair", "reorder": 400},
    {"name": "Surgical Face Mask (3-ply)", "type": "consumable", "price": 3.50, "unit": "piece", "reorder": 500},
    {"name": "Sterile Gauze Pad 10x10 cm", "type": "consumable", "price": 7.50, "unit": "piece", "reorder": 200},
    {"name": "Cotton Roll 500 g", "type": "consumable", "price": 130.00, "unit": "roll", "reorder": 30},
    {"name": "IV Cannula 20G", "type": "consumable", "price": 28.00, "unit": "piece", "reorder": 100},
    {"name": "IV Infusion Set", "type": "consumable", "price": 32.00, "unit": "set", "reorder": 100},
    {"name": "Adhesive Bandage Strip", "type": "consumable", "price": 2.00, "unit": "piece", "reorder": 300},
    {"name": "Povidone Iodine Solution 100 mL", "type": "consumable", "price": 85.00, "unit": "bottle", "reorder": 40},
    {"name": "Alcohol Swab", "type": "consumable", "price": 1.20, "unit": "piece", "reorder": 500},
]

EQUIPMENT: List[Dict] = [
    {"name": "Digital BP Monitor", "type": "equipment", "price": 2200.00, "unit": "piece", "reorder": 2},
    {"name": "Digital Thermometer", "type": "equipment", "price": 250.00, "unit": "piece", "reorder": 10},
    {"name": "Pulse Oximeter", "type": "equipment", "price": 1500.00, "unit": "piece", "reorder": 5},
    {"name": "Nebuliser Machine", "type": "equipment", "price": 1800.00, "unit": "piece", "reorder": 2},
    {"name": "Glucometer", "type": "equipment", "price": 1100.00, "unit": "piece", "reorder": 3},
]

# --------------------------------------------------------------------------
# Common conditions, for medical history records
# --------------------------------------------------------------------------
COMMON_CONDITIONS: List[Dict] = [
    {"condition": "Type 2 Diabetes Mellitus", "icd10": "E11", "status": "managing"},
    {"condition": "Essential Hypertension", "icd10": "I10", "status": "managing"},
    {"condition": "Bronchial Asthma", "icd10": "J45", "status": "managing"},
    {"condition": "Hypothyroidism", "icd10": "E03.9", "status": "managing"},
    {"condition": "Iron Deficiency Anaemia", "icd10": "D50.9", "status": "active"},
    {"condition": "Gastro-oesophageal Reflux Disease", "icd10": "K21.9", "status": "managing"},
    {"condition": "Osteoarthritis of Knee", "icd10": "M17", "status": "managing"},
    {"condition": "Allergic Rhinitis", "icd10": "J30.9", "status": "active"},
    {"condition": "Dyslipidaemia", "icd10": "E78.5", "status": "managing"},
    {"condition": "Vitamin D Deficiency", "icd10": "E55.9", "status": "resolved"},
]

# --------------------------------------------------------------------------
# Message templates
# --------------------------------------------------------------------------
NOTIFICATION_TEMPLATES: List[Dict] = [
    {
        "code": "booking_confirmation",
        "channel": "whatsapp",
        "body": (
            "Your appointment is confirmed for {date} at {time} with {doctor}. "
            "Please arrive 10 minutes early and bring any previous reports."
        ),
    },
    {
        "code": "reminder_24h",
        "channel": "whatsapp",
        "body": "Reminder: you have an appointment tomorrow, {date} at {time}, with {doctor}.",
    },
    {
        "code": "reminder_2h",
        "channel": "whatsapp",
        "body": "Your appointment with {doctor} is in about 2 hours, at {time} today.",
    },
    {
        "code": "cancelled",
        "channel": "whatsapp",
        "body": "Your appointment on {date} at {time} with {doctor} has been cancelled. Call us to rebook.",
    },
    {
        "code": "rescheduled",
        "channel": "whatsapp",
        "body": "Your appointment has been moved to {date} at {time} with {doctor}.",
    },
    {
        "code": "lab_report_ready",
        "channel": "sms",
        "body": "Your lab report is ready. Collect it from the clinic or view it in the patient portal.",
    },
]
