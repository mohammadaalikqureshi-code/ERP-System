"""AI endpoints: the assistant chatbot and the clinical automations.

All of these are rate limited separately from the rest of the API because each
call costs money — see `RATE_LIMIT_AI_PER_MINUTE`.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_active_user
from app.core.exceptions import BaseAPIException
from app.middleware.clinic_scope import get_clinic_scope
from app.middleware.rate_limit import rate_limiter
from app.middleware.rbac import require_permission
from app.models.user import User
from app.modules.ai.provider import AiRequestFailed, AiUnavailable
from app.modules.ai.schemas import (
    AiStatus,
    ChatRequest,
    ChatResponse,
    ConversationDetail,
    ConversationSummary,
    DigestRequest,
    DigestResponse,
    InsightResponse,
    PrescriptionCheckRequest,
    PrescriptionCheckResponse,
    TriageRequest,
    TriageResponse,
)
from app.modules.ai.service import AiService

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

# Applied to every endpoint that costs an API call.
ai_rate_limit = Depends(rate_limiter(limit=settings.RATE_LIMIT_AI_PER_MINUTE, scope="ai"))


class AiNotConfigured(BaseAPIException):
    """503 rather than 500: the service is fine, it just has no key yet."""

    def __init__(self, message: str):
        super().__init__(message, code="ai_unavailable", status_code=503)


def _translate(exc: Exception) -> BaseAPIException:
    if isinstance(exc, AiUnavailable):
        return AiNotConfigured(str(exc))
    if isinstance(exc, AiRequestFailed):
        return BaseAPIException(str(exc), code="ai_request_failed", status_code=502)
    raise exc


@router.get("/status", response_model=AiStatus)
async def ai_status(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(get_current_active_user),
):
    """Whether the assistant is usable. The UI calls this before showing AI features."""
    return await AiService(db).status(clinic_id)


@router.post("/chat", response_model=ChatResponse, dependencies=[ai_rate_limit])
async def chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(require_permission("ai.use")),
):
    """Ask the staff assistant a question."""
    try:
        return await AiService(db).chat(
            clinic_id=clinic_id,
            message=payload.message,
            conversation_id=payload.conversation_id,
            user_id=current_user.id,
            patient_id=payload.patient_id,
            audience="staff",
        )
    except (AiUnavailable, AiRequestFailed) as exc:
        raise _translate(exc)


@router.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(require_permission("ai.use")),
):
    return await AiService(db).list_conversations(clinic_id, current_user.id)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("ai.use")),
):
    return await AiService(db).get_conversation(conversation_id)


@router.post(
    "/consultations/{appointment_id}/summary",
    response_model=InsightResponse,
    dependencies=[ai_rate_limit],
)
async def summarise_consultation(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(require_permission("emr.create")),
):
    """Draft a consultation summary from the visit's recorded data."""
    try:
        result = await AiService(db).summarise_consultation(clinic_id, appointment_id, current_user.id)
    except (AiUnavailable, AiRequestFailed) as exc:
        raise _translate(exc)
    return InsightResponse(
        id=result["id"], kind="consultation_summary", content=result["content"], model=result["model"]
    )


@router.post(
    "/prescriptions/check", response_model=PrescriptionCheckResponse, dependencies=[ai_rate_limit]
)
async def check_prescription(
    payload: PrescriptionCheckRequest,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(require_permission("prescriptions.create")),
):
    """Review a draft prescription for interactions, allergies and dosing."""
    try:
        return await AiService(db).check_prescription(
            clinic_id,
            payload.patient_id,
            [medicine.model_dump() for medicine in payload.medicines],
            current_user.id,
        )
    except (AiUnavailable, AiRequestFailed) as exc:
        raise _translate(exc)


@router.post(
    "/lab-orders/{order_id}/interpretation",
    response_model=InsightResponse,
    dependencies=[ai_rate_limit],
)
async def interpret_lab_results(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(require_permission("lab.read")),
):
    """Explain a completed lab order's results."""
    try:
        result = await AiService(db).interpret_lab_results(clinic_id, order_id, current_user.id)
    except (AiUnavailable, AiRequestFailed) as exc:
        raise _translate(exc)
    return InsightResponse(
        id=result["id"], kind="lab_interpretation", content=result["content"], model=result["model"]
    )


@router.post("/triage", response_model=TriageResponse, dependencies=[ai_rate_limit])
async def triage_note(
    payload: TriageRequest,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(require_permission("appointments.create")),
):
    """Structure a receptionist's free-text reason-for-visit note."""
    try:
        return await AiService(db).triage_note(clinic_id, payload.note)
    except (AiUnavailable, AiRequestFailed) as exc:
        raise _translate(exc)


@router.post("/digest", response_model=DigestResponse, dependencies=[ai_rate_limit])
async def daily_digest(
    payload: DigestRequest,
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    current_user: User = Depends(require_permission("reports.read")),
):
    """Generate the end-of-day operations briefing."""
    try:
        return await AiService(db).daily_digest(clinic_id, payload.on, current_user.id)
    except (AiUnavailable, AiRequestFailed) as exc:
        raise _translate(exc)


@router.get("/insights", response_model=List[InsightResponse])
async def list_insights(
    kind: Optional[str] = Query(None, description="Filter by insight type"),
    entity_id: Optional[uuid.UUID] = Query(None, description="Filter by the record it is about"),
    db: AsyncSession = Depends(get_db),
    clinic_id: uuid.UUID = Depends(get_clinic_scope),
    _user: User = Depends(require_permission("ai.use")),
):
    """Previously generated AI output, so nothing has to be regenerated."""
    return await AiService(db).list_insights(clinic_id, kind, entity_id)
