"""Market-ready model enhancements

- InventoryItem: batch_number, manufacture_date, supplier_name, hsn_code, category, generic_name, prescription_required
- PurchaseOrder: new table
- LabTestCatalog: unit, reference_range_min/max, critical_low/high, method
- LabResult: unit, reference_range, flag, is_abnormal, verified_by, verified_at
- Clinic: tagline, primary_color, header_image_url, footer_text, registration_number, drug_license_number
- ClinicSettings: cgst_rate, sgst_rate, razorpay_key_id/secret, sms_*, whatsapp_*, tts_*
- Bill: cgst_amount, sgst_amount, hsn_sac_code, razorpay_order_id/payment_id, payment_link, notes
- Payment: razorpay_signature, receipt_url
"""
import asyncio
import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)

DDL_STATEMENTS = [
    # --- InventoryItem ---
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR;",
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS manufacture_date TIMESTAMPTZ;",
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS supplier_name VARCHAR;",
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR;",
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category VARCHAR;",
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS generic_name VARCHAR;",
    "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS prescription_required BOOLEAN DEFAULT FALSE;",

    # --- PurchaseOrder ---
    """CREATE TABLE IF NOT EXISTS purchase_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL REFERENCES clinics(id),
        po_number VARCHAR NOT NULL,
        supplier_name VARCHAR NOT NULL,
        status VARCHAR DEFAULT 'draft',
        items JSONB NOT NULL,
        total_amount NUMERIC DEFAULT 0,
        notes TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ
    );""",

    # --- LabTestCatalog ---
    "ALTER TABLE lab_test_catalog ADD COLUMN IF NOT EXISTS unit VARCHAR;",
    "ALTER TABLE lab_test_catalog ADD COLUMN IF NOT EXISTS reference_range_min FLOAT;",
    "ALTER TABLE lab_test_catalog ADD COLUMN IF NOT EXISTS reference_range_max FLOAT;",
    "ALTER TABLE lab_test_catalog ADD COLUMN IF NOT EXISTS critical_low FLOAT;",
    "ALTER TABLE lab_test_catalog ADD COLUMN IF NOT EXISTS critical_high FLOAT;",
    "ALTER TABLE lab_test_catalog ADD COLUMN IF NOT EXISTS method VARCHAR;",

    # --- LabResult ---
    "ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS unit VARCHAR;",
    "ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS reference_range VARCHAR;",
    "ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS flag VARCHAR;",
    "ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS is_abnormal BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);",
    "ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;",

    # --- Clinic Branding ---
    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tagline VARCHAR;",
    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS primary_color VARCHAR DEFAULT '#0d9488';",
    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS header_image_url VARCHAR;",
    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS footer_text VARCHAR;",
    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS registration_number VARCHAR;",
    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS drug_license_number VARCHAR;",

    # --- ClinicSettings ---
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC DEFAULT 9.0;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC DEFAULT 9.0;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS razorpay_key_id VARCHAR;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS razorpay_key_secret VARCHAR;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS sms_provider VARCHAR;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS sms_api_key VARCHAR;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS sms_sender_id VARCHAR;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS auto_sms_appointment BOOLEAN DEFAULT TRUE;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS auto_sms_prescription BOOLEAN DEFAULT TRUE;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS auto_sms_lab_report BOOLEAN DEFAULT TRUE;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS tts_enabled BOOLEAN DEFAULT TRUE;",
    "ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS tts_language VARCHAR DEFAULT 'en-IN';",

    # --- Bill GST & Payment Gateway ---
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC DEFAULT 0;",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC DEFAULT 0;",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR;",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR;",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR;",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_link VARCHAR;",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS notes TEXT;",

    # --- Payment ---
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR;",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url VARCHAR;",

    # --- Seed lab test reference ranges ---
    """UPDATE lab_test_catalog SET
        unit = 'g/dL', reference_range_min = 12.0, reference_range_max = 17.5, critical_low = 7.0, critical_high = 20.0
    WHERE test_name ILIKE '%hemoglobin%' AND reference_range_min IS NULL;""",

    """UPDATE lab_test_catalog SET
        unit = 'mg/dL', reference_range_min = 70, reference_range_max = 110, critical_low = 40, critical_high = 400
    WHERE test_name ILIKE '%blood sugar%' OR test_name ILIKE '%glucose%' AND reference_range_min IS NULL;""",

    """UPDATE lab_test_catalog SET
        unit = 'mg/dL', reference_range_min = 0, reference_range_max = 200, critical_high = 300
    WHERE test_name ILIKE '%cholesterol%' AND reference_range_min IS NULL;""",

    """UPDATE lab_test_catalog SET
        unit = 'cells/mcL', reference_range_min = 4000, reference_range_max = 11000, critical_low = 2000, critical_high = 30000
    WHERE test_name ILIKE '%wbc%' OR test_name ILIKE '%white blood%' AND reference_range_min IS NULL;""",

    """UPDATE lab_test_catalog SET
        unit = 'mg/dL', reference_range_min = 0.6, reference_range_max = 1.2, critical_high = 4.0
    WHERE test_name ILIKE '%creatinine%' AND reference_range_min IS NULL;""",

    """UPDATE lab_test_catalog SET
        unit = 'mIU/L', reference_range_min = 0.4, reference_range_max = 4.0, critical_low = 0.1, critical_high = 10.0
    WHERE test_name ILIKE '%tsh%' OR test_name ILIKE '%thyroid%' AND reference_range_min IS NULL;""",
]


async def run_migration():
    async with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            try:
                await conn.execute(text(stmt))
                logger.info(f"✓ {stmt[:60]}...")
            except Exception as e:
                logger.warning(f"⚠ {stmt[:60]}... → {e}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_migration())
