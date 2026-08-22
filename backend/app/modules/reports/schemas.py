from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import date
from uuid import UUID

class RevenueReportResponse(BaseModel):
    total_revenue: float
    by_payment_mode: Dict[str, float]
    daily_revenue: List[Dict[str, Any]] # e.g. [{"date": "2023-10-01", "revenue": 1000}]

class DoctorPerformanceResponse(BaseModel):
    doctor_id: UUID
    doctor_name: str
    total_patients: int
    completed_appointments: int
    # Paid revenue from this doctor's appointments in the period.
    revenue_generated: float = 0.0

class AppointmentsReportResponse(BaseModel):
    total_appointments: int
    completed: int
    cancelled: int
    no_shows: int
    cancellation_rate: float
    no_show_rate: float

class InventoryConsumptionResponse(BaseModel):
    item_name: str
    total_consumed: int
