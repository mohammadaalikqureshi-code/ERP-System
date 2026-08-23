"""SMS and WhatsApp gateway abstraction.

Supports multiple providers (Twilio, MSG91, Gupshup) behind a unified
interface. When no provider is configured the messages are logged to the
console so development can proceed without real credentials.

Usage:
    gateway = await SMSGateway.for_clinic(db, clinic_id)
    await gateway.send_sms("+919876543210", "Your appointment is confirmed.")
    await gateway.send_whatsapp("+919876543210", "Your prescription is ready.")
"""

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clinic import Clinic, ClinicSettings

logger = logging.getLogger(__name__)


class SMSGateway:
    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        sender_id: Optional[str] = None,
        whatsapp_enabled: bool = False,
        clinic_name: str = "Hospital",
    ):
        self.provider = provider
        self.api_key = api_key
        self.sender_id = sender_id
        self.whatsapp_enabled = whatsapp_enabled
        self.clinic_name = clinic_name

    @classmethod
    async def for_clinic(cls, db: AsyncSession, clinic_id: UUID) -> "SMSGateway":
        clinic = (await db.execute(
            select(Clinic).where(Clinic.id == clinic_id)
        )).scalar_one_or_none()

        settings = (await db.execute(
            select(ClinicSettings).where(ClinicSettings.clinic_id == clinic_id)
        )).scalar_one_or_none()

        return cls(
            provider=settings.sms_provider if settings else None,
            api_key=settings.sms_api_key if settings else None,
            sender_id=settings.sms_sender_id if settings else None,
            whatsapp_enabled=settings.whatsapp_enabled if settings else False,
            clinic_name=clinic.name if clinic else "Hospital",
        )

    async def send_sms(self, phone: str, message: str) -> dict:
        """Send an SMS via the configured provider."""
        if not self.provider or not self.api_key:
            logger.info(f"[SMS-DEV] To: {phone} | {message}")
            return {"status": "logged", "provider": "console", "phone": phone}

        if self.provider == "twilio":
            return await self._send_twilio_sms(phone, message)
        elif self.provider == "msg91":
            return await self._send_msg91_sms(phone, message)
        elif self.provider == "gupshup":
            return await self._send_gupshup_sms(phone, message)
        else:
            logger.warning(f"Unknown SMS provider: {self.provider}")
            return {"status": "unsupported_provider"}

    async def send_whatsapp(self, phone: str, message: str) -> dict:
        """Send a WhatsApp message via the configured provider."""
        if not self.whatsapp_enabled:
            logger.info(f"[WHATSAPP-DEV] To: {phone} | {message}")
            return {"status": "logged", "provider": "console", "phone": phone}

        if self.provider == "twilio":
            return await self._send_twilio_whatsapp(phone, message)
        elif self.provider == "gupshup":
            return await self._send_gupshup_whatsapp(phone, message)
        else:
            logger.info(f"[WHATSAPP-DEV] To: {phone} | {message}")
            return {"status": "logged", "provider": "console"}

    async def send_appointment_confirmation(self, phone: str, patient_name: str, doctor_name: str, date: str, time: str, token: str) -> dict:
        msg = (
            f"Dear {patient_name}, your appointment with {doctor_name} "
            f"on {date} at {time} is confirmed. Token: {token}. "
            f"- {self.clinic_name}"
        )
        return await self.send_sms(phone, msg)

    async def send_prescription_ready(self, phone: str, patient_name: str, download_link: str = "") -> dict:
        msg = (
            f"Dear {patient_name}, your prescription is ready. "
            f"{('Download: ' + download_link + ' ') if download_link else ''}"
            f"- {self.clinic_name}"
        )
        return await self.send_sms(phone, msg)

    async def send_lab_report_ready(self, phone: str, patient_name: str, download_link: str = "") -> dict:
        msg = (
            f"Dear {patient_name}, your lab report is ready. "
            f"{('Download: ' + download_link + ' ') if download_link else ''}"
            f"Please consult your doctor. - {self.clinic_name}"
        )
        return await self.send_sms(phone, msg)

    async def send_payment_receipt(self, phone: str, patient_name: str, amount: float, bill_number: str) -> dict:
        msg = (
            f"Dear {patient_name}, payment of ₹{amount:.2f} received. "
            f"Bill #{bill_number}. Thank you! - {self.clinic_name}"
        )
        return await self.send_sms(phone, msg)

    # --- Provider implementations ---

    async def _send_twilio_sms(self, phone: str, message: str) -> dict:
        try:
            from twilio.rest import Client
            parts = self.api_key.split(":", 1)
            if len(parts) != 2:
                raise ValueError("Twilio API key must be in format ACCOUNT_SID:AUTH_TOKEN")
            client = Client(parts[0], parts[1])
            msg = client.messages.create(
                body=message,
                from_=self.sender_id,
                to=phone,
            )
            return {"status": "sent", "sid": msg.sid, "provider": "twilio"}
        except ImportError:
            logger.warning("twilio package not installed")
            return {"status": "sdk_missing", "provider": "twilio"}
        except Exception as e:
            logger.error(f"Twilio SMS failed: {e}")
            return {"status": "error", "error": str(e), "provider": "twilio"}

    async def _send_twilio_whatsapp(self, phone: str, message: str) -> dict:
        try:
            from twilio.rest import Client
            parts = self.api_key.split(":", 1)
            client = Client(parts[0], parts[1])
            msg = client.messages.create(
                body=message,
                from_=f"whatsapp:{self.sender_id}",
                to=f"whatsapp:{phone}",
            )
            return {"status": "sent", "sid": msg.sid, "provider": "twilio_whatsapp"}
        except ImportError:
            logger.warning("twilio package not installed")
            return {"status": "sdk_missing", "provider": "twilio"}
        except Exception as e:
            logger.error(f"Twilio WhatsApp failed: {e}")
            return {"status": "error", "error": str(e)}

    async def _send_msg91_sms(self, phone: str, message: str) -> dict:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.msg91.com/api/v5/flow/",
                    headers={"authkey": self.api_key, "Content-Type": "application/json"},
                    json={
                        "sender": self.sender_id or "HOSPTL",
                        "route": "4",
                        "country": "91",
                        "sms": [{"message": message, "to": [phone.replace("+91", "")]}],
                    },
                )
                return {"status": "sent" if resp.status_code == 200 else "error", "provider": "msg91"}
        except ImportError:
            logger.warning("httpx not installed for MSG91")
            return {"status": "sdk_missing", "provider": "msg91"}
        except Exception as e:
            logger.error(f"MSG91 SMS failed: {e}")
            return {"status": "error", "error": str(e)}

    async def _send_gupshup_sms(self, phone: str, message: str) -> dict:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://enterprise.smsgupshup.com/GatewayAPI/rest",
                    data={
                        "method": "SendMessage",
                        "send_to": phone,
                        "msg": message,
                        "msg_type": "TEXT",
                        "userid": self.sender_id or "",
                        "auth_scheme": "plain",
                        "password": self.api_key,
                        "v": "1.1",
                        "format": "json",
                    },
                )
                return {"status": "sent" if resp.status_code == 200 else "error", "provider": "gupshup"}
        except Exception as e:
            logger.error(f"Gupshup SMS failed: {e}")
            return {"status": "error", "error": str(e)}

    async def _send_gupshup_whatsapp(self, phone: str, message: str) -> dict:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.gupshup.io/wa/api/v1/msg",
                    headers={"apikey": self.api_key},
                    data={
                        "channel": "whatsapp",
                        "source": self.sender_id,
                        "destination": phone,
                        "message": message,
                    },
                )
                return {"status": "sent" if resp.status_code in (200, 202) else "error", "provider": "gupshup_whatsapp"}
        except Exception as e:
            logger.error(f"Gupshup WhatsApp failed: {e}")
            return {"status": "error", "error": str(e)}
