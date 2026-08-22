from typing import Any, Dict, List

from pydantic import BaseModel


class AppointmentStatusCounts(BaseModel):
    booked: int = 0
    checkedIn: int = 0
    inConsultation: int = 0
    completed: int = 0
    cancelled: int = 0
    noShow: int = 0


class ReceptionDashboard(BaseModel):
    totalPatients: int = 0
    revenue: float = 0.0
    appointments: AppointmentStatusCounts = AppointmentStatusCounts()
    recentAppointments: List[Any] = []


class DoctorDashboard(BaseModel):
    todayAppointments: Dict[str, int] = {}
    # Measured from today's consultations; falls back to the doctor's slot length.
    avgConsultationTime: float = 0.0
    todayEarnings: float = 0.0
    upcomingFollowUps: int = 0
    pendingLabOrders: int = 0
    totalPatients: int = 0
    completed: int = 0
    pending: int = 0


class AdminDashboard(BaseModel):
    # Revenue for the current calendar month.
    totalRevenue: float = 0.0
    totalPatients: int = 0
    totalAppointments: int = 0
    activeDoctors: int = 0
    lowStockItems: int = 0
    unpaidBills: int = 0
    noShowRate: float = 0.0
