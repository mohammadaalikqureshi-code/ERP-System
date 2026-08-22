"""Encryption for data stored at rest.

Used for patient identifiers (Aadhaar) and for third-party API keys. Both are
things we must be able to read back, so this is reversible encryption (Fernet /
AES-128-CBC with an HMAC), not hashing.

Set `ENCRYPTION_KEY` in the environment to a real Fernet key:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

In development, if no key is configured, one is derived from `SECRET_KEY` so the
app still runs. Production refuses to start without a real key (see config).
"""

import base64
import hashlib
import logging
from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)


class DecryptionError(Exception):
    """Raised when stored ciphertext cannot be read back."""


@lru_cache
def _cipher() -> Fernet:
    if settings.ENCRYPTION_KEY:
        return Fernet(settings.ENCRYPTION_KEY.encode())

    # Development fallback: a deterministic key derived from SECRET_KEY. This
    # keeps local data readable across restarts without shipping a real key.
    logger.warning(
        "ENCRYPTION_KEY is not set — deriving a development key from SECRET_KEY. "
        "Set a real Fernet key before going live."
    )
    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt a value for storage. `None` and empty strings pass through."""
    if not plaintext:
        return plaintext
    return _cipher().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypt a stored value.

    Raises `DecryptionError` rather than silently returning the ciphertext —
    quietly handing back encrypted bytes is how corrupt data reaches a patient
    record unnoticed.
    """
    if not ciphertext:
        return ciphertext
    try:
        return _cipher().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise DecryptionError(
            "Stored value could not be decrypted. The ENCRYPTION_KEY has most "
            "likely changed since it was written."
        ) from exc


def try_decrypt(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypt, returning `None` if the value is unreadable.

    For display paths where one bad row should not break the whole response.
    """
    try:
        return decrypt(ciphertext)
    except DecryptionError:
        logger.warning("Skipping a value that could not be decrypted.")
        return None


def mask(value: Optional[str], visible: int = 4) -> str:
    """Mask a sensitive value for display: 123456789012 -> '••••••••9012'."""
    if not value:
        return ""
    if len(value) <= visible:
        return "•" * len(value)
    return "•" * (len(value) - visible) + value[-visible:]
