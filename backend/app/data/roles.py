"""Roles and what each one may do.

Permissions are `resource.action` strings, checked by `require_permission` on
every endpoint. This is the single place they are defined — change a role here
and re-run the seed to apply it.
"""

from typing import Dict, List

# Everything the system understands. Useful for validation and for the admin UI.
ALL_PERMISSIONS: List[str] = [
    "clinics.create", "clinics.read", "clinics.update", "clinics.delete",
    "branches.create", "branches.read", "branches.update", "branches.delete",
    "patients.create", "patients.read", "patients.update", "patients.delete",
    "appointments.create", "appointments.read", "appointments.update", "appointments.delete",
    "queue.create", "queue.read", "queue.update", "queue.delete",
    "billing.create", "billing.read", "billing.update", "billing.refund",
    "prescriptions.create", "prescriptions.read", "prescriptions.update",
    "emr.create", "emr.read", "emr.update", "emr.delete",
    "lab.create", "lab.read", "lab.update", "lab.delete",
    "inventory.create", "inventory.read", "inventory.update", "inventory.delete",
    "employees.create", "employees.read", "employees.update", "employees.delete",
    "reports.read", "dashboard.read", "audit.read",
    "settings.create", "settings.read", "settings.update",
    "ai.use",
    "patient_portal.read",
]

ROLES: Dict[str, Dict] = {
    "super_admin": {
        "description": "Full access across every clinic on the platform.",
        "permissions": ALL_PERMISSIONS,
    },
    "clinic_admin": {
        "description": "Runs one clinic: staff, settings, reports and panels.",
        "permissions": [
            permission
            for permission in ALL_PERMISSIONS
            if permission not in {"clinics.create", "clinics.delete", "patient_portal.read"}
        ],
    },
    "doctor": {
        "description": "Consults patients, writes prescriptions, orders tests.",
        "permissions": [
            "clinics.read", "branches.read",
            "patients.read", "patients.update",
            "appointments.read", "appointments.update",
            "queue.read", "queue.update",
            "prescriptions.create", "prescriptions.read", "prescriptions.update",
            "emr.create", "emr.read", "emr.update",
            "lab.create", "lab.read",
            "billing.read", "reports.read", "dashboard.read",
            "ai.use",
        ],
    },
    "receptionist": {
        "description": "Front desk: registration, booking, queue and billing.",
        "permissions": [
            "clinics.read", "branches.read",
            "patients.create", "patients.read", "patients.update",
            "appointments.create", "appointments.read", "appointments.update", "appointments.delete",
            "queue.create", "queue.read", "queue.update", "queue.delete",
            "billing.create", "billing.read", "billing.update",
            "lab.read", "dashboard.read",
            "ai.use",
        ],
    },
    "nurse": {
        "description": "Records vitals and assists with consultations.",
        "permissions": [
            "clinics.read", "patients.read",
            "appointments.read", "queue.read", "queue.update",
            "emr.create", "emr.read", "emr.update",
            "dashboard.read", "ai.use",
        ],
    },
    "lab_staff": {
        "description": "Runs the diagnostic laboratory.",
        "permissions": [
            "clinics.read", "patients.read", "appointments.read",
            "lab.create", "lab.read", "lab.update", "lab.delete",
            "dashboard.read", "ai.use",
        ],
    },
    "pharmacist": {
        "description": "Dispenses medicines and manages stock.",
        "permissions": [
            "clinics.read", "patients.read", "prescriptions.read",
            "inventory.create", "inventory.read", "inventory.update", "inventory.delete",
            "billing.create", "billing.read",
            "dashboard.read", "ai.use",
        ],
    },
    "patient": {
        "description": "Portal access to their own records only.",
        "permissions": ["patient_portal.read", "appointments.read", "emr.read", "lab.read"],
    },
}
