"""The catalogue of switchable panels.

Adding a panel to the product means adding one entry here — the admin screen,
the API and the frontend navigation all read from this list, so there is no
second place to update.

`default_enabled=False` is for anything a clinic should opt into deliberately
(the AI assistant costs money per use, so it is off until someone turns it on).
"""

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class ModuleDefinition:
    key: str
    label: str
    description: str
    default_enabled: bool = True
    # Roles that work in this panel. Shown in the admin UI as a hint.
    roles: tuple[str, ...] = ()


MODULE_CATALOG: List[ModuleDefinition] = [
    ModuleDefinition(
        key="reception",
        label="Reception & Front Desk",
        description="Patient registration, appointment booking, token queue and billing.",
        roles=("receptionist", "clinic_admin"),
    ),
    ModuleDefinition(
        key="doctor",
        label="Doctor & EMR",
        description="Consultation workspace, vitals, prescriptions and medical records.",
        roles=("doctor",),
    ),
    ModuleDefinition(
        key="lab",
        label="Diagnostic Laboratory",
        description="Test catalogue, sample tracking, result entry and lab reports.",
        roles=("lab_staff",),
    ),
    ModuleDefinition(
        key="inventory",
        label="Pharmacy & Inventory",
        description="Stock levels, batches, expiry tracking and reorder alerts.",
        roles=("pharmacist",),
    ),
    ModuleDefinition(
        key="patient_portal",
        label="Patient Portal",
        description="Patient login, live queue position and access to their own reports.",
        roles=("patient",),
    ),
    ModuleDefinition(
        key="queue_display",
        label="Waiting Room Display",
        description="Full-screen token display for the waiting area.",
    ),
    ModuleDefinition(
        key="ai_assistant",
        label="AI Assistant",
        description=(
            "Chat assistant, consultation summaries, prescription safety checks, "
            "lab interpretation and the daily digest. Requires an AI API key and "
            "is billed per use by the AI provider."
        ),
        default_enabled=False,
    ),
    ModuleDefinition(
        key="reports",
        label="Analytics & Reports",
        description="Revenue, doctor performance and no-show reporting.",
        roles=("clinic_admin", "super_admin"),
    ),
    ModuleDefinition(
        key="notifications",
        label="Patient Notifications",
        description="WhatsApp and SMS appointment reminders. Requires a messaging key.",
        default_enabled=False,
    ),
]

MODULES_BY_KEY: Dict[str, ModuleDefinition] = {module.key: module for module in MODULE_CATALOG}
