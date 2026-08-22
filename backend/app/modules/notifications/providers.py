"""Message delivery for reminders and one-time codes.

Which provider is used comes from settings (`WHATSAPP_PROVIDER`,
`SMS_PROVIDER`). The mock providers write to the log instead of sending, which
is what you want in development and in tests — nothing is silently swallowed,
and no real message goes to a real patient.
"""

import logging
from abc import ABC, abstractmethod

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class MessageProvider(ABC):
    @abstractmethod
    async def send_message(self, recipient: str, content: str) -> bool:
        """Send a message. Returns True when the provider accepted it."""


class MockWhatsAppProvider(MessageProvider):
    async def send_message(self, recipient: str, content: str) -> bool:
        logger.info(
            "WhatsApp message (mock provider — not actually sent)",
            extra={"recipient_suffix": recipient[-4:], "length": len(content)},
        )
        return True


class MockSMSProvider(MessageProvider):
    async def send_message(self, recipient: str, content: str) -> bool:
        logger.info(
            "SMS (mock provider — not actually sent)",
            extra={"recipient_suffix": recipient[-4:], "length": len(content)},
        )
        return True


class MetaWhatsAppProvider(MessageProvider):
    """WhatsApp Business Cloud API."""

    API_URL = "https://graph.facebook.com/v21.0"

    def __init__(self, token: str, phone_number_id: str):
        self.token = token
        self.phone_number_id = phone_number_id

    async def send_message(self, recipient: str, content: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    f"{self.API_URL}/{self.phone_number_id}/messages",
                    headers={"Authorization": f"Bearer {self.token}"},
                    json={
                        "messaging_product": "whatsapp",
                        "to": recipient,
                        "type": "text",
                        "text": {"body": content},
                    },
                )
            response.raise_for_status()
            return True
        except httpx.HTTPError:
            logger.error("WhatsApp send failed", extra={"recipient_suffix": recipient[-4:]}, exc_info=True)
            return False


class Msg91SmsProvider(MessageProvider):
    """MSG91 transactional SMS."""

    API_URL = "https://control.msg91.com/api/v5/flow"

    def __init__(self, api_key: str, sender_id: str):
        self.api_key = api_key
        self.sender_id = sender_id

    async def send_message(self, recipient: str, content: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    self.API_URL,
                    headers={"authkey": self.api_key, "Content-Type": "application/json"},
                    json={
                        "sender": self.sender_id,
                        "mobiles": f"91{recipient[-10:]}",
                        "message": content,
                    },
                )
            response.raise_for_status()
            return True
        except httpx.HTTPError:
            logger.error("SMS send failed", extra={"recipient_suffix": recipient[-4:]}, exc_info=True)
            return False


def get_provider(channel: str, api_key: str | None = None) -> MessageProvider:
    """Build the configured provider for a channel.

    `api_key` comes from the clinic's stored credentials when it has its own;
    otherwise the platform-wide value from settings is used. Any missing
    credential falls back to the mock provider rather than failing — a clinic
    without messaging configured should still be able to work.
    """
    if channel == "whatsapp":
        token = api_key or settings.WHATSAPP_API_TOKEN
        if settings.WHATSAPP_PROVIDER == "meta" and token and settings.WHATSAPP_PHONE_NUMBER_ID:
            return MetaWhatsAppProvider(token, settings.WHATSAPP_PHONE_NUMBER_ID)
        return MockWhatsAppProvider()

    key = api_key or settings.MSG91_API_KEY
    if settings.SMS_PROVIDER == "msg91" and key:
        return Msg91SmsProvider(key, settings.MSG91_SENDER_ID)
    return MockSMSProvider()
