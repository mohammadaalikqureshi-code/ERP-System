"""Laboratory report PDFs.

Values outside their reference range are flagged, which is the whole point of
handing a clinician a report rather than a list of numbers.
"""

import re
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.documents.pdf import render_pdf
from app.documents.templates import lab_report_html
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.lab import LabOrder, LabResult

# Matches "3.5 - 5.1", "3.5-5.1", "3.5 to 5.1"
RANGE_PATTERN = re.compile(r"^\s*([\d.]+)\s*(?:-|to)\s*([\d.]+)")


def is_out_of_range(value: Optional[str], reference: Optional[str]) -> bool:
    """Best-effort check of a numeric result against a numeric range.

    Anything it cannot parse (e.g. "Negative", "< 0.5") is reported as normal
    rather than guessed at — a wrong flag on a lab report is worse than none.
    """
    if not value or not reference:
        return False

    match = RANGE_PATTERN.match(reference)
    if not match:
        return False

    try:
        measured = float(str(value).strip())
    except ValueError:
        return False

    low, high = float(match.group(1)), float(match.group(2))
    return measured < low or measured > high


class LabReportPDFGenerator:
    @staticmethod
    async def build(db: AsyncSession, order_id: UUID, interpretation: Optional[str] = None) -> bytes:
        order = (
            await db.execute(
                select(LabOrder)
                .options(
                    selectinload(LabOrder.patient),
                    selectinload(LabOrder.doctor).selectinload(Doctor.user),
                    selectinload(LabOrder.results).selectinload(LabResult.test),
                )
                .where(LabOrder.id == order_id)
            )
        ).scalar_one_or_none()

        if not order:
            raise NotFoundError("Lab order not found")

        patient = order.patient
        clinic = (
            await db.execute(select(Clinic).where(Clinic.id == patient.clinic_id))
        ).scalar_one_or_none()

        html = lab_report_html(
            clinic={
                "name": clinic.name if clinic else "Clinic",
                "address": clinic.address if clinic else "",
                "phone": clinic.phone if clinic else "",
                "email": clinic.email if clinic else "",
            },
            patient={
                "full_name": patient.full_name,
                "patient_code": patient.patient_code,
                "age": patient.age,
                "gender": patient.gender,
                "mobile": patient.mobile,
            },
            order={
                "reference": str(order.id)[:8].upper(),
                "status": order.status,
                "doctor_name": (
                    order.doctor.user.full_name if order.doctor and order.doctor.user else None
                ),
            },
            results=[
                {
                    "test_name": result.test.test_name if result.test else "—",
                    "result_value": result.result_value,
                    "normal_range": result.test.normal_range if result.test else None,
                    "remarks": result.remarks,
                    "is_abnormal": is_out_of_range(
                        result.result_value, result.test.normal_range if result.test else None
                    ),
                }
                for result in order.results
            ],
            interpretation=interpretation,
        )
        return render_pdf(html)
