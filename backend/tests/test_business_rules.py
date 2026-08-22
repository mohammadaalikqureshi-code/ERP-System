"""Tests for the rules that decide what the software will and will not accept.

These are the ones a clinic would notice if they broke: mobile numbers, visit
types, lab reference ranges, and the billing arithmetic.
"""

import pytest
from pydantic import ValidationError

from app.modules.appointments.schemas import AppointmentCreate, StatusUpdate
from app.modules.lab.pdf_generator import is_out_of_range
from app.modules.patients.schemas import PatientCreate


class TestPatientValidation:
    def test_name_can_be_given_in_two_parts(self):
        patient = PatientCreate(
            first_name="Ramesh", last_name="Gupta", mobile="9811100001", gender="male"
        )
        assert patient.full_name == "Ramesh Gupta"

    def test_mobile_is_normalised(self):
        patient = PatientCreate(
            full_name="Test", mobile="+91 98111 00001", gender="female"
        )
        assert patient.mobile == "9811100001"

    def test_short_mobile_is_rejected(self):
        with pytest.raises(ValidationError):
            PatientCreate(full_name="Test", mobile="12345", gender="male")

    def test_gender_is_normalised(self):
        patient = PatientCreate(full_name="Test", mobile="9811100001", gender="MALE")
        assert patient.gender == "male"

    def test_unknown_gender_is_rejected(self):
        with pytest.raises(ValidationError):
            PatientCreate(full_name="Test", mobile="9811100001", gender="unknown")

    def test_allergies_list_becomes_a_readable_string(self):
        patient = PatientCreate(
            full_name="Test", mobile="9811100001", gender="male", allergies=["Dust", "Pollen"]
        )
        assert patient.allergies == "Dust, Pollen"

    def test_age_is_derived_from_date_of_birth(self):
        from datetime import date

        patient = PatientCreate(
            full_name="Test",
            mobile="9811100001",
            gender="male",
            dob=date(2000, 1, 1),
        )
        assert patient.age == date.today().year - 2000 - (
            (date.today().month, date.today().day) < (1, 1)
        )

    def test_a_name_is_required(self):
        with pytest.raises(ValidationError):
            PatientCreate(mobile="9811100001", gender="male")


class TestAppointmentValidation:
    def test_visit_type_accepts_the_forms_the_ui_sends(self):
        from datetime import date, time
        from uuid import uuid4

        for given, expected in [
            ("NEW", "new"),
            ("Follow_Up", "follow_up"),
            ("follow-up", "follow_up"),
            ("EMERGENCY", "emergency"),
        ]:
            appointment = AppointmentCreate(
                patient_id=uuid4(),
                doctor_id=uuid4(),
                visit_type=given,
                appointment_date=date.today(),
                appointment_time=time(10, 0),
            )
            assert appointment.visit_type == expected

    def test_unknown_visit_type_is_rejected(self):
        from datetime import date, time
        from uuid import uuid4

        with pytest.raises(ValidationError):
            AppointmentCreate(
                patient_id=uuid4(),
                doctor_id=uuid4(),
                visit_type="walk-in-maybe",
                appointment_date=date.today(),
                appointment_time=time(10, 0),
            )

    def test_status_must_be_one_the_system_knows(self):
        assert StatusUpdate(status="CHECKED_IN").status == "checked_in"
        with pytest.raises(ValidationError):
            StatusUpdate(status="teleported")


class TestLabReferenceRanges:
    @pytest.mark.parametrize(
        "value,reference,expected",
        [
            ("14.2", "13.0 - 17.0 g/dL", False),   # within range
            ("11.0", "13.0 - 17.0 g/dL", True),    # below
            ("18.5", "13.0 - 17.0 g/dL", True),    # above
            ("13.0", "13.0 - 17.0 g/dL", False),   # exactly the lower bound
            ("17.0", "13.0 - 17.0 g/dL", False),   # exactly the upper bound
            ("Negative", "Non-reactive", False),   # qualitative, never flagged
            ("", "13.0 - 17.0", False),            # nothing entered
            ("14.2", "", False),                   # no reference range
        ],
    )
    def test_flagging(self, value, reference, expected):
        assert is_out_of_range(value, reference) is expected

    def test_unparseable_values_are_not_guessed_at(self):
        """A wrong flag on a lab report is worse than no flag."""
        assert is_out_of_range("< 0.5", "0.3 - 1.2") is False


class TestBillingArithmetic:
    def test_gst_and_total(self):
        from decimal import Decimal

        subtotal = Decimal("900.00")
        discount = Decimal("100.00")
        taxable = subtotal - discount
        gst = (taxable * Decimal("0.18")).quantize(Decimal("0.01"))

        assert gst == Decimal("144.00")
        assert taxable + gst == Decimal("944.00")
