"""The event contract shared between the backend and the browser.

Every real-time message has the same shape:

    {"type": "APPOINTMENT_STATUS_CHANGED", "entityId": "...", "data": {...}}

Adding an event means adding a constant here and calling `publish()` from the
service that changed the data. The frontend maps each type to the React Query
keys it should refresh (see `frontend/src/lib/realtime.ts`), so the two files
are meant to be read together.
"""

from typing import Any, Dict, Optional
from uuid import UUID


class Events:
    # Queue and appointments
    APPOINTMENT_CREATED = "APPOINTMENT_CREATED"
    APPOINTMENT_STATUS_CHANGED = "APPOINTMENT_STATUS_CHANGED"
    APPOINTMENT_RESCHEDULED = "APPOINTMENT_RESCHEDULED"
    QUEUE_UPDATED = "QUEUE_UPDATED"

    # Clinical
    VITALS_RECORDED = "VITALS_RECORDED"
    PRESCRIPTION_CREATED = "PRESCRIPTION_CREATED"

    # Laboratory
    LAB_ORDER_CREATED = "LAB_ORDER_CREATED"
    LAB_ORDER_STATUS_CHANGED = "LAB_ORDER_STATUS_CHANGED"
    LAB_RESULT_READY = "LAB_RESULT_READY"

    # Money
    BILL_CREATED = "BILL_CREATED"
    PAYMENT_RECORDED = "PAYMENT_RECORDED"

    # Stock
    STOCK_CHANGED = "STOCK_CHANGED"
    STOCK_LOW = "STOCK_LOW"

    # In-App Staff Notifications
    NOTIFICATION_RECEIVED = "NOTIFICATION_RECEIVED"



def room_for_clinic(clinic_id: UUID | str) -> str:
    """Staff room: everyone signed in to this clinic."""
    return f"clinic:{clinic_id}"


def public_room_for_clinic(clinic_id: UUID | str) -> str:
    """Waiting-room room: no patient identifiers are ever sent here."""
    return f"public:{clinic_id}"


def build(event_type: str, entity_id: Optional[UUID | str] = None, **data: Any) -> Dict[str, Any]:
    message: Dict[str, Any] = {"type": event_type}
    if entity_id is not None:
        message["entityId"] = str(entity_id)
    if data:
        message["data"] = data
    return message
