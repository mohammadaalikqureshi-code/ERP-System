"""AI features: the assistant chatbot and the clinical automations.

Every method here follows the same shape:
  1. gather the real records the request is about,
  2. render them as plain text the model can read,
  3. ask Claude with a task-specific system prompt,
  4. store the result so it is auditable and does not need regenerating.

If no API key is configured, nothing raises — `status()` reports the assistant
as unavailable and the UI hides or disables the AI panels.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.models.appointment import Appointment
from app.models.billing import Bill
from app.models.doctor import Doctor
from app.models.emr import MedicalHistory, Prescription, Vitals
from app.models.inventory import InventoryItem
from app.models.lab import LabOrder
from app.models.patient import Patient
from app.models.system import AiConversation, AiInsight, AiMessage
from app.modules.ai import prompts
from app.modules.ai.provider import AiProvider, AiReply, AiRequestFailed, AiUnavailable, make_provider
from app.modules.api_keys.service import ApiKeyService

logger = logging.getLogger(__name__)


class AiService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.keys = ApiKeyService(db)

    # ------------------------------------------------------------ plumbing
    async def _provider(self, clinic_id: Optional[UUID]) -> AiProvider:
        if not settings.AI_ENABLED:
            raise AiUnavailable("AI features are switched off for this deployment.")

        api_key = await self.keys.resolve(settings.AI_PROVIDER, clinic_id)
        if not api_key:
            raise AiUnavailable(
                "No AI API key is configured. An administrator can add one under "
                "Settings → API Keys."
            )
        return make_provider(settings.AI_PROVIDER, api_key)

    async def _ask(
        self,
        clinic_id: Optional[UUID],
        system: str,
        messages: List[dict],
        max_tokens: Optional[int] = None,
    ) -> AiReply:
        """Run one request and record whether the key worked."""
        provider = await self._provider(clinic_id)
        try:
            reply = await provider.complete(system, messages, max_tokens)
        except AiRequestFailed as exc:
            await self.keys.record_usage(settings.AI_PROVIDER, clinic_id, error=str(exc))
            raise

        await self.keys.record_usage(settings.AI_PROVIDER, clinic_id)
        return reply

    async def status(self, clinic_id: Optional[UUID]) -> dict:
        """Whether the assistant can be used, and why not if it cannot."""
        if not settings.AI_ENABLED:
            return {"available": False, "reason": "AI features are switched off for this deployment."}

        api_key = await self.keys.resolve(settings.AI_PROVIDER, clinic_id)
        if not api_key:
            return {
                "available": False,
                "reason": "No AI API key configured. Add one under Settings → API Keys.",
            }

        return {"available": True, "provider": settings.AI_PROVIDER, "model": settings.AI_MODEL}

    async def _save_insight(
        self,
        clinic_id: UUID,
        kind: str,
        content: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        model: Optional[str] = None,
        user_id: Optional[UUID] = None,
        data: Optional[dict] = None,
    ) -> AiInsight:
        insight = AiInsight(
            clinic_id=clinic_id,
            kind=kind,
            entity_type=entity_type,
            entity_id=entity_id,
            content=content,
            data=data,
            model=model,
            generated_by=user_id,
        )
        self.db.add(insight)
        await self.db.commit()
        await self.db.refresh(insight)
        return insight

    # ---------------------------------------------------------------- chat
    async def chat(
        self,
        clinic_id: Optional[UUID],
        message: str,
        conversation_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        patient_id: Optional[UUID] = None,
        audience: str = "staff",
    ) -> dict:
        """Answer a chat message, remembering the thread it belongs to."""
        message = message.strip()
        if not message:
            raise ValidationError("Please type a message.")

        conversation = await self._get_or_create_conversation(
            conversation_id, clinic_id, user_id, patient_id, audience, message
        )

        history = await self._recent_messages(conversation.id)
        history.append({"role": "user", "content": message})

        system = prompts.PATIENT_ASSISTANT if audience == "patient" else prompts.STAFF_ASSISTANT
        if patient_id:
            context = await self._patient_context(patient_id, for_patient=audience == "patient")
            if context:
                system = f"{system}\n\nThe conversation is about this patient:\n{context}"

        reply = await self._ask(clinic_id, system, history)

        self.db.add(AiMessage(conversation_id=conversation.id, role="user", content=message))
        self.db.add(
            AiMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=reply.text,
                input_tokens=reply.input_tokens,
                output_tokens=reply.output_tokens,
                model=reply.model,
            )
        )
        await self.db.commit()

        return {
            "conversation_id": conversation.id,
            "reply": reply.text,
            "model": reply.model,
        }

    async def _get_or_create_conversation(
        self,
        conversation_id: Optional[UUID],
        clinic_id: Optional[UUID],
        user_id: Optional[UUID],
        patient_id: Optional[UUID],
        audience: str,
        first_message: str,
    ) -> AiConversation:
        if conversation_id:
            found = (
                await self.db.execute(
                    select(AiConversation).where(AiConversation.id == conversation_id)
                )
            ).scalar_one_or_none()
            if not found:
                raise NotFoundError("Conversation not found")
            return found

        conversation = AiConversation(
            clinic_id=clinic_id,
            user_id=user_id,
            patient_id=patient_id,
            audience=audience,
            # A readable title for the sidebar, taken from the opening message.
            title=(first_message[:60] + "…") if len(first_message) > 60 else first_message,
        )
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def _recent_messages(self, conversation_id: UUID) -> List[dict]:
        """The tail of the thread, newest last, capped so requests stay cheap."""
        statement = (
            select(AiMessage)
            .where(AiMessage.conversation_id == conversation_id)
            .order_by(AiMessage.created_at.desc())
            .limit(settings.AI_CHAT_HISTORY_LIMIT)
        )
        rows = list((await self.db.execute(statement)).scalars().all())
        return [{"role": row.role, "content": row.content} for row in reversed(rows)]

    async def list_conversations(self, clinic_id: Optional[UUID], user_id: UUID) -> List[AiConversation]:
        statement = (
            select(AiConversation)
            .where(AiConversation.clinic_id == clinic_id, AiConversation.user_id == user_id)
            .order_by(AiConversation.created_at.desc())
            .limit(30)
        )
        return list((await self.db.execute(statement)).scalars().all())

    async def get_conversation(self, conversation_id: UUID) -> AiConversation:
        statement = (
            select(AiConversation)
            .options(selectinload(AiConversation.messages))
            .where(AiConversation.id == conversation_id)
        )
        conversation = (await self.db.execute(statement)).scalar_one_or_none()
        if not conversation:
            raise NotFoundError("Conversation not found")
        return conversation

    # -------------------------------------------------------- automations
    async def summarise_consultation(
        self, clinic_id: UUID, appointment_id: UUID, user_id: Optional[UUID] = None
    ) -> dict:
        """Draft a consultation summary from what was recorded during the visit."""
        appointment = await self._get_appointment(clinic_id, appointment_id)
        patient = await self._get_patient(appointment.patient_id)
        vitals = (
            await self.db.execute(select(Vitals).where(Vitals.appointment_id == appointment_id))
        ).scalar_one_or_none()
        prescription = (
            await self.db.execute(
                select(Prescription)
                .options(selectinload(Prescription.items))
                .where(Prescription.appointment_id == appointment_id)
            )
        ).scalar_one_or_none()
        history = list(
            (
                await self.db.execute(
                    select(MedicalHistory).where(MedicalHistory.patient_id == patient.id)
                )
            )
            .scalars()
            .all()
        )

        lines = [
            f"Patient: {patient.full_name}, {self._describe_age(patient)}, {patient.gender}",
            f"Allergies: {patient.allergies or 'None recorded'}",
            f"Visit: {appointment.visit_type} visit in {appointment.department} "
            f"on {appointment.appointment_date}",
            f"Reason given at booking: {appointment.notes or 'Not recorded'}",
        ]

        if history:
            lines.append(
                "Known conditions: "
                + "; ".join(f"{h.condition} ({h.status})" for h in history)
            )
        else:
            lines.append("Known conditions: None recorded")

        if vitals:
            lines.append(
                "Vitals: "
                + ", ".join(
                    part
                    for part in [
                        f"BP {vitals.blood_pressure}" if vitals.blood_pressure else "",
                        f"temp {vitals.temperature}" if vitals.temperature else "",
                        f"weight {vitals.weight} kg" if vitals.weight else "",
                        f"height {vitals.height} cm" if vitals.height else "",
                        f"BMI {vitals.bmi:.1f}" if vitals.bmi else "",
                    ]
                    if part
                )
                or "Not recorded"
            )
            if vitals.notes:
                lines.append(f"Examination notes: {vitals.notes}")
        else:
            lines.append("Vitals: Not recorded")

        if prescription and prescription.items:
            lines.append("Prescribed:")
            lines.extend(
                f"  - {item.medicine_name} {item.dosage}, {item.frequency}, "
                f"{item.duration_days} ({item.instructions or 'no special instructions'})"
                for item in prescription.items
            )
            if prescription.notes:
                lines.append(f"Doctor's notes: {prescription.notes}")
        else:
            lines.append("Prescribed: Nothing recorded")

        reply = await self._ask(
            clinic_id,
            prompts.CONSULTATION_SUMMARY,
            [{"role": "user", "content": "\n".join(lines)}],
        )

        insight = await self._save_insight(
            clinic_id,
            "consultation_summary",
            reply.text,
            entity_type="appointment",
            entity_id=appointment_id,
            model=reply.model,
            user_id=user_id,
        )
        return {"id": insight.id, "content": reply.text, "model": reply.model}

    async def check_prescription(
        self,
        clinic_id: UUID,
        patient_id: UUID,
        medicines: List[dict],
        user_id: Optional[UUID] = None,
    ) -> dict:
        """Safety-check a draft prescription before the doctor signs it.

        Takes the draft rather than a saved prescription, so problems are caught
        while they can still be corrected.
        """
        if not medicines:
            raise ValidationError("Add at least one medicine before running the safety check.")

        patient = await self._get_patient(patient_id)
        history = list(
            (
                await self.db.execute(
                    select(MedicalHistory).where(MedicalHistory.patient_id == patient_id)
                )
            )
            .scalars()
            .all()
        )

        lines = [
            f"Patient: {self._describe_age(patient)}, {patient.gender}",
            f"Known allergies: {patient.allergies or 'None recorded'}",
            "Existing conditions: "
            + ("; ".join(f"{h.condition} ({h.status})" for h in history) or "None recorded"),
            "",
            "Draft prescription:",
        ]
        for medicine in medicines:
            lines.append(
                f"  - {medicine.get('medicine_name') or medicine.get('medicineName', '?')} "
                f"{medicine.get('dosage', '?')}, {medicine.get('frequency', '?')}, "
                f"{medicine.get('duration_days') or medicine.get('durationDays', '?')}"
            )

        reply = await self._ask(
            clinic_id, prompts.PRESCRIPTION_CHECK, [{"role": "user", "content": "\n".join(lines)}]
        )

        # A crude but useful signal for the UI: colour the panel red if the
        # model raised anything it marked CRITICAL.
        has_critical = "CRITICAL" in reply.text.upper()

        insight = await self._save_insight(
            clinic_id,
            "prescription_check",
            reply.text,
            entity_type="patient",
            entity_id=patient_id,
            model=reply.model,
            user_id=user_id,
            data={"has_critical": has_critical, "medicine_count": len(medicines)},
        )
        return {
            "id": insight.id,
            "content": reply.text,
            "has_critical": has_critical,
            "model": reply.model,
        }

    async def interpret_lab_results(
        self, clinic_id: UUID, order_id: UUID, user_id: Optional[UUID] = None
    ) -> dict:
        """Explain a completed lab order to the clinician who ordered it."""
        statement = (
            select(LabOrder)
            .options(selectinload(LabOrder.results))
            .where(LabOrder.id == order_id)
        )
        order = (await self.db.execute(statement)).scalar_one_or_none()
        if not order:
            raise NotFoundError("Lab order not found")
        if not order.results:
            raise ValidationError("This order has no results entered yet.")

        patient = await self._get_patient(order.patient_id)

        lines = [f"Patient: {self._describe_age(patient)}, {patient.gender}", "", "Results:"]
        for result in order.results:
            test_name = result.test.test_name if result.test else "Unknown test"
            reference = result.test.normal_range if result.test else None
            lines.append(
                f"  - {test_name}: {result.result_value or 'not entered'}"
                + (f" (reference range {reference})" if reference else "")
                + (f" — {result.remarks}" if result.remarks else "")
            )

        reply = await self._ask(
            clinic_id, prompts.LAB_INTERPRETATION, [{"role": "user", "content": "\n".join(lines)}]
        )

        insight = await self._save_insight(
            clinic_id,
            "lab_interpretation",
            reply.text,
            entity_type="lab_order",
            entity_id=order_id,
            model=reply.model,
            user_id=user_id,
        )
        return {"id": insight.id, "content": reply.text, "model": reply.model}

    async def triage_note(self, clinic_id: UUID, note: str) -> dict:
        """Turn a receptionist's free-text note into structured triage info."""
        note = note.strip()
        if not note:
            raise ValidationError("Enter the patient's reason for visiting.")

        reply = await self._ask(
            clinic_id, prompts.TRIAGE_NOTE, [{"role": "user", "content": note}], max_tokens=400
        )
        return {"content": reply.text, "model": reply.model}

    async def daily_digest(
        self, clinic_id: UUID, on: Optional[date] = None, user_id: Optional[UUID] = None
    ) -> dict:
        """Write the administrator's end-of-day briefing from the day's numbers."""
        target_day = on or date.today()
        stats = await self.collect_daily_stats(clinic_id, target_day)

        lines = [
            f"Date: {target_day:%d/%m/%Y}",
            f"Appointments booked: {stats['appointments_total']}",
            f"Completed: {stats['completed']}",
            f"Cancelled: {stats['cancelled']}",
            f"No-shows: {stats['no_shows']} ({stats['no_show_rate']}% of booked)",
            f"Still waiting at close: {stats['waiting']}",
            f"Revenue billed: ₹{stats['revenue']:.2f}",
            f"Unpaid bills: {stats['unpaid_bills']}",
            f"Stock items at or below reorder level: {stats['low_stock_count']}",
        ]
        if stats["low_stock_items"]:
            lines.append("Low stock: " + ", ".join(stats["low_stock_items"]))
        if stats["busiest_doctor"]:
            lines.append(f"Busiest doctor: {stats['busiest_doctor']}")

        reply = await self._ask(
            clinic_id, prompts.DAILY_DIGEST, [{"role": "user", "content": "\n".join(lines)}], max_tokens=600
        )

        insight = await self._save_insight(
            clinic_id,
            "daily_digest",
            reply.text,
            entity_type="clinic",
            entity_id=clinic_id,
            model=reply.model,
            user_id=user_id,
            data=stats,
        )
        return {"id": insight.id, "content": reply.text, "stats": stats, "model": reply.model}

    async def collect_daily_stats(self, clinic_id: UUID, target_day: date) -> dict:
        """The day's numbers. Also useful on its own for the admin dashboard."""
        appointments = list(
            (
                await self.db.execute(
                    select(Appointment).where(
                        Appointment.clinic_id == clinic_id,
                        Appointment.appointment_date == target_day,
                    )
                )
            )
            .scalars()
            .all()
        )

        total = len(appointments)
        completed = sum(1 for a in appointments if a.status == "completed")
        cancelled = sum(1 for a in appointments if a.status == "cancelled")
        no_shows = sum(1 for a in appointments if a.status == "no_show")
        waiting = sum(1 for a in appointments if a.status in ("booked", "checked_in"))

        start = datetime.combine(target_day, datetime.min.time()).replace(tzinfo=timezone.utc)
        revenue = (
            await self.db.execute(
                select(func.coalesce(func.sum(Bill.total_amount), 0)).where(
                    Bill.clinic_id == clinic_id,
                    Bill.created_at >= start,
                    Bill.created_at < start + timedelta(days=1),
                )
            )
        ).scalar() or 0

        unpaid = (
            await self.db.execute(
                select(func.count(Bill.id)).where(
                    Bill.clinic_id == clinic_id, Bill.payment_status != "paid"
                )
            )
        ).scalar() or 0

        low_stock = list(
            (
                await self.db.execute(
                    select(InventoryItem).where(
                        InventoryItem.clinic_id == clinic_id,
                        InventoryItem.is_deleted == False,  # noqa: E712
                        InventoryItem.stock_quantity <= InventoryItem.reorder_level,
                    )
                )
            )
            .scalars()
            .all()
        )

        busiest = None
        if appointments:
            counts: dict[UUID, int] = {}
            for appointment in appointments:
                counts[appointment.doctor_id] = counts.get(appointment.doctor_id, 0) + 1
            top_doctor_id = max(counts, key=counts.get)
            doctor = (
                await self.db.execute(
                    select(Doctor).options(selectinload(Doctor.user)).where(Doctor.id == top_doctor_id)
                )
            ).scalar_one_or_none()
            if doctor and doctor.user:
                busiest = f"{doctor.user.full_name} ({counts[top_doctor_id]} patients)"

        return {
            "date": target_day.isoformat(),
            "appointments_total": total,
            "completed": completed,
            "cancelled": cancelled,
            "no_shows": no_shows,
            "no_show_rate": round(no_shows / total * 100, 1) if total else 0.0,
            "waiting": waiting,
            "revenue": float(revenue),
            "unpaid_bills": int(unpaid),
            "low_stock_count": len(low_stock),
            "low_stock_items": [f"{item.name} ({item.stock_quantity} left)" for item in low_stock[:10]],
            "busiest_doctor": busiest,
        }

    async def list_insights(
        self, clinic_id: UUID, kind: Optional[str] = None, entity_id: Optional[UUID] = None
    ) -> List[AiInsight]:
        statement = select(AiInsight).where(AiInsight.clinic_id == clinic_id)
        if kind:
            statement = statement.where(AiInsight.kind == kind)
        if entity_id:
            statement = statement.where(AiInsight.entity_id == entity_id)
        statement = statement.order_by(AiInsight.created_at.desc()).limit(50)
        return list((await self.db.execute(statement)).scalars().all())

    # ------------------------------------------------------------- helpers
    async def _get_patient(self, patient_id: UUID) -> Patient:
        patient = (
            await self.db.execute(select(Patient).where(Patient.id == patient_id))
        ).scalar_one_or_none()
        if not patient:
            raise NotFoundError("Patient not found")
        return patient

    async def _get_appointment(self, clinic_id: UUID, appointment_id: UUID) -> Appointment:
        appointment = (
            await self.db.execute(
                select(Appointment).where(
                    Appointment.id == appointment_id, Appointment.clinic_id == clinic_id
                )
            )
        ).scalar_one_or_none()
        if not appointment:
            raise NotFoundError("Appointment not found")
        return appointment

    @staticmethod
    def _describe_age(patient: Patient) -> str:
        if patient.age:
            return f"{patient.age} years old"
        if patient.dob:
            years = (date.today() - patient.dob).days // 365
            return f"{years} years old"
        return "age not recorded"

    async def _patient_context(self, patient_id: UUID, for_patient: bool) -> str:
        """A short factual briefing about a patient, for the chat system prompt.

        Patients get less than staff: no clinical history, only what is theirs
        to see anyway.
        """
        patient = await self._get_patient(patient_id)

        if for_patient:
            return f"Name: {patient.full_name}. Patient ID: {patient.patient_code}."

        history = list(
            (
                await self.db.execute(
                    select(MedicalHistory).where(MedicalHistory.patient_id == patient_id)
                )
            )
            .scalars()
            .all()
        )
        return "\n".join(
            [
                f"Name: {patient.full_name} ({patient.patient_code})",
                f"Age/sex: {self._describe_age(patient)}, {patient.gender}",
                f"Allergies: {patient.allergies or 'None recorded'}",
                "Conditions: "
                + ("; ".join(f"{h.condition} ({h.status})" for h in history) or "None recorded"),
            ]
        )
