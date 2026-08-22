from typing import Callable, Any
from fastapi import Depends, HTTPException
from functools import wraps
from app.core.deps import get_current_active_user

# Module mappings
RBAC_MATRIX = {
    "Clinics": {"Super Admin": ["C", "R", "U", "D"], "Doctor": ["R"], "Receptionist": ["R"], "Lab Staff": ["R"], "Pharmacist": ["R"]},
    "Doctors/staff": {"Super Admin": ["C", "R", "U", "D"], "Doctor": ["R"], "Receptionist": ["R"], "Lab Staff": [], "Pharmacist": []},
    "Patients": {"Super Admin": ["C", "R", "U", "D"], "Doctor": ["R"], "Receptionist": ["C", "R", "U", "D"], "Lab Staff": ["R"], "Pharmacist": ["R"]},
    "Appointments": {"Super Admin": ["R"], "Doctor": ["R", "U"], "Receptionist": ["C", "R", "U", "D"], "Lab Staff": ["R"], "Pharmacist": []},
    "Queue": {"Super Admin": ["R"], "Doctor": ["R", "U"], "Receptionist": ["C", "R", "U", "D"], "Lab Staff": [], "Pharmacist": []},
    "Prescriptions": {"Super Admin": ["R"], "Doctor": ["C", "R", "U", "D"], "Receptionist": ["R"], "Lab Staff": [], "Pharmacist": ["R"]},
    "EMR/vitals": {"Super Admin": ["R"], "Doctor": ["C", "R", "U", "D"], "Receptionist": ["R"], "Lab Staff": [], "Pharmacist": []},
    "Lab tests": {"Super Admin": ["R"], "Doctor": ["C", "R"], "Receptionist": ["R"], "Lab Staff": ["C", "R", "U", "D"], "Pharmacist": []},
    "Billing": {"Super Admin": ["R", "refund"], "Doctor": ["R"], "Receptionist": ["C", "R", "U", "D"], "Lab Staff": [], "Pharmacist": ["C"]},
    "Inventory (medicine)": {"Super Admin": ["C", "R", "U", "D"], "Doctor": ["R"], "Receptionist": [], "Lab Staff": [], "Pharmacist": ["C", "R", "U", "D"]},
    "Reports/analytics": {"Super Admin": ["R"], "Doctor": ["R"], "Receptionist": ["R"], "Lab Staff": [], "Pharmacist": []},
    "Audit logs": {"Super Admin": ["R"], "Doctor": [], "Receptionist": [], "Lab Staff": [], "Pharmacist": []},
    "Settings": {"Super Admin": ["C", "R", "U", "D"], "Doctor": [], "Receptionist": [], "Lab Staff": [], "Pharmacist": []}
}

def require_permission(module: str, action: str) -> Callable:
    def permission_dependency(current_user: Any = Depends(get_current_active_user)):
        # Assuming current_user.role is an enum or string, and has a 'name' attribute or is a string
        # Need to handle based on actual role structure
        # User model has 'role' relation, so current_user.role.name should be the string
        role_name = current_user.role.name if hasattr(current_user, "role") and current_user.role else ""
        
        allowed_actions = RBAC_MATRIX.get(module, {}).get(role_name, [])
        if action not in allowed_actions:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        
        return current_user
    return permission_dependency
