from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, cast, func, select, Date
from sqlalchemy.orm import selectinload
from app.models.billing import Bill, Payment
from app.models.doctor import Doctor
from app.models.user import User
from app.models.appointment import Appointment
from app.models.inventory import InventoryTransaction, InventoryItem
from app.modules.reports.schemas import (
    RevenueReportResponse,
    DoctorPerformanceResponse,
    AppointmentsReportResponse,
    InventoryConsumptionResponse
)
from datetime import date, datetime
import uuid
from typing import List

class ReportsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_revenue_report(self, clinic_id: uuid.UUID, start_date: date, end_date: date) -> RevenueReportResponse:
        # Total revenue & by payment mode (from Payment model where status = success)
        stmt = select(Payment.mode, func.sum(Payment.amount)).join(Bill, Payment.bill_id == Bill.id).where(
            Bill.clinic_id == clinic_id,
            Payment.status == "success",
            cast(Payment.paid_at, Date) >= start_date,
            cast(Payment.paid_at, Date) <= end_date
        ).group_by(Payment.mode)
        
        results = (await self.db.execute(stmt)).all()
        by_payment_mode = {row[0]: float(row[1]) for row in results}
        total_revenue = sum(by_payment_mode.values())

        # Daily revenue
        daily_stmt = select(cast(Payment.paid_at, Date), func.sum(Payment.amount)).join(Bill, Payment.bill_id == Bill.id).where(
            Bill.clinic_id == clinic_id,
            Payment.status == "success",
            cast(Payment.paid_at, Date) >= start_date,
            cast(Payment.paid_at, Date) <= end_date
        ).group_by(cast(Payment.paid_at, Date)).order_by(cast(Payment.paid_at, Date))
        
        daily_results = (await self.db.execute(daily_stmt)).all()
        daily_revenue = [{"date": row[0].isoformat(), "revenue": float(row[1])} for row in daily_results]

        return RevenueReportResponse(
            total_revenue=total_revenue,
            by_payment_mode=by_payment_mode,
            daily_revenue=daily_revenue
        )

    async def get_doctor_performance(self, clinic_id: uuid.UUID, start_date: date, end_date: date) -> List[DoctorPerformanceResponse]:
        # Count appointments by doctor
        stmt = select(
            Doctor.id, 
            User.full_name,
            func.count(Appointment.id).label("total_appointments"),
            func.sum(case((Appointment.status == "completed", 1), else_=0)).label("completed")
        ).select_from(Doctor).join(User, Doctor.user_id == User.id).outerjoin(
            Appointment, 
            (Appointment.doctor_id == Doctor.id) & 
            (cast(Appointment.appointment_date, Date) >= start_date) & 
            (cast(Appointment.appointment_date, Date) <= end_date)
        ).where(
            Doctor.clinic_id == clinic_id
        ).group_by(Doctor.id, User.full_name)

        results = (await self.db.execute(stmt)).all()

        # Revenue attributable to each doctor, from paid bills on their
        # appointments in the same window.
        revenue_stmt = (
            select(Appointment.doctor_id, func.coalesce(func.sum(Bill.total_amount), 0))
            .join(Bill, Bill.appointment_id == Appointment.id)
            .where(
                Appointment.clinic_id == clinic_id,
                Bill.payment_status == "paid",
                cast(Appointment.appointment_date, Date) >= start_date,
                cast(Appointment.appointment_date, Date) <= end_date,
            )
            .group_by(Appointment.doctor_id)
        )
        revenue_by_doctor = {
            row[0]: float(row[1]) for row in (await self.db.execute(revenue_stmt)).all()
        }

        return [
            DoctorPerformanceResponse(
                doctor_id=row.id,
                doctor_name=row.full_name,
                total_patients=row.total_appointments or 0,
                completed_appointments=row.completed or 0,
                revenue_generated=revenue_by_doctor.get(row.id, 0.0),
            ) for row in results
        ]

    async def get_appointments_report(self, clinic_id: uuid.UUID, start_date: date, end_date: date) -> AppointmentsReportResponse:
        stmt = select(
            func.count(Appointment.id).label("total"),
            func.sum(case((Appointment.status == "completed", 1), else_=0)).label("completed"),
            func.sum(case((Appointment.status == "cancelled", 1), else_=0)).label("cancelled"),
            func.sum(case((Appointment.status == "no_show", 1), else_=0)).label("no_shows")
        ).where(
            Appointment.clinic_id == clinic_id,
            cast(Appointment.appointment_date, Date) >= start_date,
            cast(Appointment.appointment_date, Date) <= end_date
        )

        row = (await self.db.execute(stmt)).one()
        total = row.total or 0
        cancelled = row.cancelled or 0
        no_shows = row.no_shows or 0

        cancellation_rate = (cancelled / total * 100) if total > 0 else 0.0
        no_show_rate = (no_shows / total * 100) if total > 0 else 0.0

        return AppointmentsReportResponse(
            total_appointments=total,
            completed=row.completed or 0,
            cancelled=cancelled,
            no_shows=no_shows,
            cancellation_rate=cancellation_rate,
            no_show_rate=no_show_rate
        )

    async def get_inventory_consumption(self, clinic_id: uuid.UUID, start_date: date, end_date: date) -> List[InventoryConsumptionResponse]:
        stmt = select(
            InventoryItem.name,
            func.sum(InventoryTransaction.quantity).label("total_consumed")
        ).join(InventoryTransaction, InventoryItem.id == InventoryTransaction.item_id).where(
            InventoryItem.clinic_id == clinic_id,
            InventoryTransaction.transaction_type == "out",
            cast(InventoryTransaction.created_at, Date) >= start_date,
            cast(InventoryTransaction.created_at, Date) <= end_date
        ).group_by(InventoryItem.name)

        results = (await self.db.execute(stmt)).all()
        
        return [
            InventoryConsumptionResponse(
                item_name=row.name,
                total_consumed=row.total_consumed or 0
            ) for row in results
        ]
