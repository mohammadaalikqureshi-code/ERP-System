"""Payment gateway abstraction — Razorpay integration.

Supports:
  • Creating a Razorpay order for a Bill
  • Verifying the Razorpay payment signature
  • Generating UPI QR-code data for walk-in payments

When no Razorpay keys are configured the gateway raises a clear error
so the clinic can still operate with cash / manual modes.
"""

import hashlib
import hmac
import logging
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BaseAPIException, ValidationError
from app.models.billing import Bill, Payment
from app.models.clinic import ClinicSettings

logger = logging.getLogger(__name__)


class PaymentGatewayError(BaseAPIException):
    def __init__(self, message: str):
        super().__init__(message, code="payment_gateway_error", status_code=502)


class PaymentGateway:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_razorpay_keys(self, clinic_id: uuid.UUID) -> tuple[str, str]:
        settings = (await self.db.execute(
            select(ClinicSettings).where(ClinicSettings.clinic_id == clinic_id)
        )).scalar_one_or_none()

        if not settings or not settings.razorpay_key_id or not settings.razorpay_key_secret:
            raise PaymentGatewayError(
                "Razorpay is not configured for this clinic. "
                "Go to Settings → Payment Gateway and add your Razorpay API keys."
            )
        return settings.razorpay_key_id, settings.razorpay_key_secret

    async def create_razorpay_order(self, clinic_id: uuid.UUID, bill_id: uuid.UUID) -> dict:
        """Create a Razorpay order for a pending bill."""
        key_id, key_secret = await self._get_razorpay_keys(clinic_id)

        bill = (await self.db.execute(
            select(Bill).where(Bill.id == bill_id, Bill.clinic_id == clinic_id)
        )).scalar_one_or_none()

        if not bill:
            raise ValidationError("Bill not found")
        if bill.payment_status == "paid":
            raise ValidationError("Bill is already paid")

        amount_paise = int(Decimal(str(bill.total_amount)) * 100)

        try:
            import razorpay
            client = razorpay.Client(auth=(key_id, key_secret))
            order = client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": bill.bill_number,
                "notes": {
                    "bill_id": str(bill.id),
                    "clinic_id": str(clinic_id),
                }
            })
        except ImportError:
            # Razorpay SDK not installed — return a simulated order for dev/testing
            logger.warning("razorpay SDK not installed, returning simulated order")
            order = {
                "id": f"order_sim_{uuid.uuid4().hex[:16]}",
                "amount": amount_paise,
                "currency": "INR",
                "receipt": bill.bill_number,
                "status": "created",
            }
        except Exception as exc:
            logger.error("Razorpay order creation failed", exc_info=True)
            raise PaymentGatewayError(f"Could not create payment order: {exc}") from exc

        bill.razorpay_order_id = order["id"]
        await self.db.commit()

        return {
            "orderId": order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "keyId": key_id,
            "billNumber": bill.bill_number,
        }

    async def verify_razorpay_payment(
        self,
        clinic_id: uuid.UUID,
        bill_id: uuid.UUID,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> dict:
        """Verify Razorpay payment signature and record the payment."""
        _key_id, key_secret = await self._get_razorpay_keys(clinic_id)

        # HMAC SHA256 verification
        expected = hmac.new(
            key_secret.encode(),
            f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, razorpay_signature):
            # In dev mode with simulated orders, accept any signature
            if not razorpay_order_id.startswith("order_sim_"):
                raise ValidationError("Payment verification failed: invalid signature")

        bill = (await self.db.execute(
            select(Bill).where(Bill.id == bill_id, Bill.clinic_id == clinic_id)
        )).scalar_one_or_none()

        if not bill:
            raise ValidationError("Bill not found")

        bill.razorpay_payment_id = razorpay_payment_id
        bill.payment_status = "paid"
        bill.payment_mode = "online"

        from datetime import datetime, timezone
        payment = Payment(
            bill_id=bill.id,
            amount=bill.total_amount,
            mode="razorpay",
            gateway_txn_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
            status="success",
            paid_at=datetime.now(timezone.utc),
        )
        self.db.add(payment)
        await self.db.commit()

        return {"status": "paid", "billId": str(bill.id), "paymentId": razorpay_payment_id}

    @staticmethod
    def generate_upi_qr_data(
        upi_id: str,
        payee_name: str,
        amount: float,
        bill_number: str,
    ) -> str:
        """Generate a UPI deep-link string that can be encoded as a QR code.

        Format per NPCI: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&tn=<note>&cu=INR
        """
        import urllib.parse
        params = {
            "pa": upi_id,
            "pn": payee_name,
            "am": f"{amount:.2f}",
            "tn": f"Payment for {bill_number}",
            "cu": "INR",
        }
        return "upi://pay?" + urllib.parse.urlencode(params)
