from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.lab import LabTestCatalog, LabOrder, LabResult
from app.models.patient import Patient
from app.websockets.events import Events, build, room_for_clinic
from app.websockets.queue_manager import manager
from app.models.doctor import Doctor
from app.models.user import User
from app.modules.lab.schemas import LabTestCatalogCreate, LabTestCatalogUpdate, LabOrderCreate, LabOrderUpdate, LabResultCreate
from uuid import UUID
from datetime import datetime, timezone


def auto_flag_result(value_str: str, test: LabTestCatalog) -> dict:
    """Compute flag and is_abnormal based on reference ranges from catalog."""
    flag = "NORMAL"
    is_abnormal = False
    ref_range_display = test.normal_range or ""

    if test.reference_range_min is not None and test.reference_range_max is not None:
        ref_range_display = f"{test.reference_range_min}-{test.reference_range_max}"
        if test.unit:
            ref_range_display += f" {test.unit}"

    try:
        measured = float(str(value_str).strip())
    except (ValueError, TypeError):
        return {"flag": flag, "is_abnormal": False, "reference_range": ref_range_display}

    if test.critical_low is not None and measured < test.critical_low:
        flag = "CRITICAL_LOW"
        is_abnormal = True
    elif test.critical_high is not None and measured > test.critical_high:
        flag = "CRITICAL_HIGH"
        is_abnormal = True
    elif test.reference_range_min is not None and measured < test.reference_range_min:
        flag = "LOW"
        is_abnormal = True
    elif test.reference_range_max is not None and measured > test.reference_range_max:
        flag = "HIGH"
        is_abnormal = True

    return {"flag": flag, "is_abnormal": is_abnormal, "reference_range": ref_range_display}


class LabService:
    @staticmethod
    def _format_test(test: LabTestCatalog) -> dict:
        return {
            "id": str(test.id),
            "clinic_id": str(test.clinic_id),
            "test_name": test.test_name,
            "name": test.test_name,
            "category": test.category,
            "price": float(test.price),
            "normal_range": test.normal_range,
            "normalRange": test.normal_range,
            "unit": test.unit or "",
            "referenceRangeMin": test.reference_range_min,
            "referenceRangeMax": test.reference_range_max,
            "criticalLow": test.critical_low,
            "criticalHigh": test.critical_high,
            "method": test.method,
        }

    @staticmethod
    def _format_order(order: LabOrder) -> dict:
        items = []
        for r in (order.results or []):
            test_obj = LabService._format_test(r.test) if r.test else {
                "id": str(r.test_id),
                "name": "General Test",
                "category": "Diagnostics",
                "price": 200.0,
                "normalRange": "-",
                "unit": ""
            }
            items.append({
                "id": str(r.id),
                "labTestId": str(r.test_id),
                "test": test_obj,
                "testName": test_obj.get("name") or test_obj.get("test_name", ""),
                "resultValue": r.result_value or "",
                "isAbnormal": r.is_abnormal or False,
                "flag": r.flag or "NORMAL",
                "referenceRange": r.reference_range or test_obj.get("normalRange", ""),
                "unit": r.unit or test_obj.get("unit", ""),
                "remarks": r.remarks or "",
                "normalRange": test_obj.get("normalRange"),
                "verifiedAt": str(r.verified_at) if r.verified_at else None,
            })

        patient_dict = {
            "id": str(order.patient.id),
            "patientCode": order.patient.patient_code,
            "firstName": order.patient.full_name,
            "lastName": "",
            "mobile": order.patient.mobile
        } if order.patient else None

        doctor_name = "Smith"
        if order.doctor and hasattr(order.doctor, 'user') and order.doctor.user:
            doctor_name = order.doctor.user.full_name

        has_abnormal = any(r.is_abnormal for r in (order.results or []) if r.is_abnormal)
        has_critical = any(
            r.flag in ("CRITICAL_HIGH", "CRITICAL_LOW")
            for r in (order.results or []) if r.flag
        )

        return {
            "id": str(order.id),
            "patientId": str(order.patient_id),
            "patient_id": str(order.patient_id),
            "doctorId": str(order.doctor_id),
            "doctor_id": str(order.doctor_id),
            "appointmentId": str(order.appointment_id) if order.appointment_id else None,
            "status": order.status,
            "orderDate": str(order.created_at) if hasattr(order, 'created_at') and order.created_at else "2026-08-17T10:00:00Z",
            "patient": patient_dict,
            "doctor": {"firstName": "Dr.", "lastName": doctor_name},
            "items": items,
            "results": items,
            "hasAbnormal": has_abnormal,
            "hasCritical": has_critical,
        }

    @staticmethod
    async def create_test(db: AsyncSession, test_data: LabTestCatalogCreate) -> dict:
        db_test = LabTestCatalog(**test_data.model_dump())
        db.add(db_test)
        await db.commit()
        await db.refresh(db_test)
        return LabService._format_test(db_test)

    @staticmethod
    async def get_all_tests(db: AsyncSession, clinic_id: UUID) -> list:
        stmt = select(LabTestCatalog)
        if clinic_id:
            stmt = stmt.filter(LabTestCatalog.clinic_id == clinic_id)
        result = await db.execute(stmt)
        tests = result.scalars().all()
        return [LabService._format_test(t) for t in tests]

    @staticmethod
    async def get_test(db: AsyncSession, test_id: UUID) -> dict:
        result = await db.execute(select(LabTestCatalog).filter(LabTestCatalog.id == test_id))
        test = result.scalar_one_or_none()
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        return LabService._format_test(test)

    @staticmethod
    async def update_test(db: AsyncSession, test_id: UUID, test_data: LabTestCatalogUpdate) -> dict:
        result = await db.execute(select(LabTestCatalog).filter(LabTestCatalog.id == test_id))
        test = result.scalar_one_or_none()
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        for key, value in test_data.model_dump(exclude_unset=True).items():
            setattr(test, key, value)
            
        await db.commit()
        await db.refresh(test)
        return LabService._format_test(test)

    @staticmethod
    async def get_all_orders(db: AsyncSession, clinic_id: UUID = None) -> list:
        stmt = select(LabOrder).options(
            selectinload(LabOrder.patient),
            selectinload(LabOrder.doctor).selectinload(Doctor.user),
            selectinload(LabOrder.results).selectinload(LabResult.test)
        ).order_by(LabOrder.created_at.desc() if hasattr(LabOrder, 'created_at') else LabOrder.id)
        
        result = await db.execute(stmt)
        orders = result.scalars().all()
        return [LabService._format_order(o) for o in orders]

    @staticmethod
    async def create_order(db: AsyncSession, order_data: LabOrderCreate) -> dict:
        db_order = LabOrder(
            patient_id=order_data.patient_id,
            doctor_id=order_data.doctor_id,
            appointment_id=order_data.appointment_id,
            status=order_data.status
        )
        db.add(db_order)
        await db.flush()
        
        for test_id in order_data.tests:
            db_result = LabResult(order_id=db_order.id, test_id=test_id)
            db.add(db_result)
            
        await db.commit()
        await LabService._announce(db, db_order, Events.LAB_ORDER_CREATED)
        
        result = await db.execute(
            select(LabOrder)
            .options(
                selectinload(LabOrder.patient),
                selectinload(LabOrder.doctor).selectinload(Doctor.user),
                selectinload(LabOrder.results).selectinload(LabResult.test)
            )
            .filter(LabOrder.id == db_order.id)
        )
        return LabService._format_order(result.scalar_one_or_none())

    @staticmethod
    async def _announce(db: AsyncSession, order: LabOrder, event: str, **data) -> None:
        """Tell the clinic's screens that a lab order changed."""
        patient = (await db.execute(
            select(Patient).where(Patient.id == order.patient_id)
        )).scalar_one_or_none()
        if patient:
            await manager.broadcast(
                room_for_clinic(patient.clinic_id), build(event, order.id, **data)
            )
            try:
                from app.modules.notifications.service import NotificationService
                notif_service = NotificationService(db)
                if event == Events.LAB_ORDER_CREATED:
                    await notif_service.create_and_broadcast(
                        clinic_id=patient.clinic_id,
                        title="New Lab Order Placed",
                        message=f"Lab test order #{str(order.id)[:8]} requested for Patient {patient.full_name}.",
                        category="lab",
                        target_role="lab_staff",
                        sender_name="Doctor OPD",
                        link="/lab",
                    )
                elif event == Events.LAB_RESULT_READY:
                    has_critical = any(
                        r.flag in ("CRITICAL_HIGH", "CRITICAL_LOW")
                        for r in (order.results or []) if r.flag
                    )
                    title = "⚠️ CRITICAL Lab Results" if has_critical else "Lab Results Ready"
                    await notif_service.create_and_broadcast(
                        clinic_id=patient.clinic_id,
                        title=title,
                        message=f"Lab test results for Patient {patient.full_name} (Order #{str(order.id)[:8]}) are published.",
                        category="lab",
                        target_role="doctor",
                        target_doctor_id=order.doctor_id,
                        sender_name="Diagnostic Lab",
                        link="/lab",
                    )
            except Exception:
                pass

    @staticmethod
    async def get_order(db: AsyncSession, order_id: UUID) -> dict:
        result = await db.execute(
            select(LabOrder)
            .options(
                selectinload(LabOrder.patient),
                selectinload(LabOrder.doctor).selectinload(Doctor.user),
                selectinload(LabOrder.results).selectinload(LabResult.test)
            )
            .filter(LabOrder.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return LabService._format_order(order)

    @staticmethod
    async def update_order_status(db: AsyncSession, order_id: UUID, order_data: LabOrderUpdate) -> dict:
        stmt = select(LabOrder).filter(LabOrder.id == order_id)
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
            
        order.status = order_data.status
        await db.commit()

        await LabService._announce(db, order, Events.LAB_RESULT_READY)
        return await LabService.get_order(db, order_id)

    @staticmethod
    async def submit_order_results(db: AsyncSession, order_id: UUID, items: list) -> dict:
        """Submit lab results with automatic abnormal flagging."""
        stmt = select(LabOrder).options(
            selectinload(LabOrder.results).selectinload(LabResult.test)
        ).filter(LabOrder.id == order_id)
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
            
        for item in items:
            result_id = item.get("id")
            val = item.get("resultValue") or item.get("result_value")
            remarks = item.get("remarks")
            for r in order.results:
                if str(r.id) == str(result_id) or str(r.test_id) == str(item.get("labTestId")):
                    r.result_value = str(val) if val is not None else ""
                    if remarks:
                        r.remarks = remarks

                    # Auto-flag based on reference ranges from the test catalog
                    if r.test and val:
                        flag_data = auto_flag_result(str(val), r.test)
                        r.flag = flag_data["flag"]
                        r.is_abnormal = flag_data["is_abnormal"]
                        r.reference_range = flag_data["reference_range"]
                        r.unit = r.test.unit or ""
                    
                    r.verified_at = datetime.now(timezone.utc)
                        
        order.status = "completed"
        await db.commit()

        await LabService._announce(db, order, Events.LAB_RESULT_READY)
        return await LabService.get_order(db, order_id)

    @staticmethod
    async def get_expiring_items(db: AsyncSession, clinic_id: UUID, days: int = 90) -> list:
        """Get inventory items expiring within the specified number of days."""
        from app.models.inventory import InventoryItem
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) + timedelta(days=days)
        stmt = select(InventoryItem).where(
            InventoryItem.clinic_id == clinic_id,
            InventoryItem.is_deleted == False,
            InventoryItem.expiry_date.isnot(None),
            InventoryItem.expiry_date <= cutoff,
        ).order_by(InventoryItem.expiry_date)
        items = (await db.execute(stmt)).scalars().all()
        return items
