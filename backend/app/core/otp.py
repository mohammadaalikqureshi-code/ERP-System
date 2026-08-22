"""One-time passwords for patient portal login.

Design notes:
  * The code is generated with `secrets`, not `random`.
  * Only a hash of it is stored, so a Redis dump does not hand out logins.
  * It lives in Redis with a TTL, so expiry is automatic.
  * Attempts are counted and the code is destroyed after too many tries,
    which stops someone brute-forcing six digits.
  * Verification uses a constant-time comparison.

In development `OTP_DEBUG_RETURN` lets the API return the code so you can log in
without an SMS gateway. Production forces that off (see `Settings`).
"""

import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from typing import Optional

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)


@dataclass
class OtpChallenge:
    sent: bool
    expires_in: int
    # Only populated in development.
    debug_code: Optional[str] = None


class OtpError(Exception):
    """Raised when a code is wrong, expired, or has been tried too often."""


def _hash(mobile: str, code: str) -> str:
    """Hash the code together with the mobile number and the app secret."""
    return hmac.new(
        settings.SECRET_KEY.encode(), f"{mobile}:{code}".encode(), hashlib.sha256
    ).hexdigest()


def _key(purpose: str, mobile: str) -> str:
    return f"otp:{purpose}:{mobile}"


async def issue(mobile: str, purpose: str = "patient_login") -> tuple[OtpChallenge, str]:
    """Create and store a fresh code.

    Returns the challenge to hand back to the caller, plus the raw code so the
    caller can send it by SMS or WhatsApp. The raw code is never stored.
    """
    code = "".join(secrets.choice("0123456789") for _ in range(settings.OTP_LENGTH))

    redis = get_redis()
    key = _key(purpose, mobile)
    await redis.delete(key)
    await redis.hset(key, mapping={"hash": _hash(mobile, code), "attempts": "0"})
    await redis.expire(key, settings.OTP_TTL_SECONDS)

    # The code itself is never logged, in any environment.
    logger.info("OTP issued", extra={"purpose": purpose, "mobile_suffix": mobile[-4:]})

    return OtpChallenge(
        sent=True,
        expires_in=settings.OTP_TTL_SECONDS,
        debug_code=code if settings.OTP_DEBUG_RETURN else None,
    ), code


async def verify(mobile: str, code: str, purpose: str = "patient_login") -> None:
    """Check a submitted code. Raises `OtpError` if it is not valid.

    A correct code is consumed, so it cannot be replayed.
    """
    redis = get_redis()
    key = _key(purpose, mobile)
    stored = await redis.hgetall(key)

    if not stored:
        raise OtpError("That code has expired. Please request a new one.")

    attempts = int(stored.get("attempts", 0)) + 1
    if attempts > settings.OTP_MAX_ATTEMPTS:
        await redis.delete(key)
        raise OtpError("Too many incorrect attempts. Please request a new code.")

    if not hmac.compare_digest(stored.get("hash", ""), _hash(mobile, code.strip())):
        await redis.hset(key, "attempts", str(attempts))
        remaining = settings.OTP_MAX_ATTEMPTS - attempts
        raise OtpError(
            f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining."
            if remaining > 0
            else "Incorrect code. Please request a new one."
        )

    await redis.delete(key)
