"""Tests that the documents handed to patients are real, complete PDFs.

The previous implementation returned the literal bytes `PDF_CONTENT_MOCK`,
which a patient would have received as a corrupt download. These tests exist so
that cannot come back.
"""

from app.documents.pdf import clean, money, render_pdf
from app.documents.templates import lab_report_html, prescription_html, receipt_html

CLINIC = {
    "name": "Sanjeevani Multi-Specialty Hospital",
    "address": "Plot 14, Sector 12, Dwarka, New Delhi 110078",
    "phone": "01145678900",
    "email": "contact@sanjeevanihospital.in",
    "gst_number": "07AABCS1429B1ZX",
}

PATIENT = {
    "full_name": "Ramesh Chandra Gupta",
    "patient_code": "PT-00001",
    "age": 58,
    "gender": "male",
    "mobile": "9811100001",
}


def is_pdf(data: bytes) -> bool:
    return data.startswith(b"%PDF-") and len(data) > 1000


class TestHelpers:
    def test_missing_values_render_as_a_dash(self):
        assert clean(None) == "—"
        assert clean("") == "—"

    def test_html_is_escaped(self):
        assert "<script>" not in clean("<script>alert(1)</script>")

    def test_money_formats_as_rupees(self):
        assert money(1234.5) == "₹1,234.50"
        assert money(None) == "₹0.00"


class TestPrescription:
    def test_renders_a_real_pdf(self):
        html = prescription_html(
            clinic=CLINIC,
            patient=PATIENT,
            doctor={
                "name": "Dr. Meera Raghavan",
                "department": "Cardiology",
                "qualification": "MBBS, MD, DM",
            },
            prescription={"reference": "AB12CD34", "notes": "Review in one week."},
            medicines=[
                {
                    "medicine_name": "Atorvastatin 10 mg Tablet",
                    "dosage": "10 mg",
                    "frequency": "0-0-1",
                    "duration_days": "30 days",
                    "instructions": "At bedtime",
                }
            ],
        )
        assert is_pdf(render_pdf(html))

    def test_handles_a_prescription_with_no_medicines(self):
        html = prescription_html(
            clinic=CLINIC,
            patient=PATIENT,
            doctor={"name": "Dr. X", "department": "General Medicine", "qualification": "MBBS"},
            prescription={"reference": "NONE", "notes": None},
            medicines=[],
        )
        assert "No medicines prescribed" in html
        assert is_pdf(render_pdf(html))


class TestReceipt:
    def test_renders_a_real_pdf(self):
        html = receipt_html(
            clinic=CLINIC,
            patient=PATIENT,
            bill={
                "bill_number": "INV-202608-0001",
                "line_items": [
                    {
                        "description": "Consultation - Cardiology",
                        "quantity": 1,
                        "unit_price": 900,
                        "amount": 900,
                    }
                ],
                "subtotal": 900,
                "discount_amount": 0,
                "gst_amount": 162,
                "total_amount": 1062,
                "payment_status": "paid",
                "payment_mode": "upi",
            },
        )
        assert "₹1,062.00" in html
        assert is_pdf(render_pdf(html))


class TestLabReport:
    def test_abnormal_values_are_flagged(self):
        html = lab_report_html(
            clinic=CLINIC,
            patient=PATIENT,
            order={"reference": "LAB123", "status": "completed", "doctor_name": "Dr. Meera"},
            results=[
                {
                    "test_name": "Haemoglobin (Hb)",
                    "result_value": "10.1",
                    "normal_range": "13.0 - 17.0 g/dL",
                    "remarks": None,
                    "is_abnormal": True,
                },
                {
                    "test_name": "Platelet Count",
                    "result_value": "250000",
                    "normal_range": "150000 - 450000 cells/µL",
                    "remarks": None,
                    "is_abnormal": False,
                },
            ],
        )
        assert "flag" in html  # the out-of-range row carries the warning class
        assert is_pdf(render_pdf(html))
