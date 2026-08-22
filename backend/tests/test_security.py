"""Tests for the security-critical pieces.

These cover the things that would be most damaging to get wrong: password
hashing, token handling, encryption of stored data, and the rules that stop one
clinic watching another's live queue.
"""

import pytest

from app.core.config import INSECURE_PLACEHOLDERS, Settings
from app.core.crypto import DecryptionError, decrypt, encrypt, mask
from app.core.security import create_access_token, get_password_hash, verify_password
from app.websockets.auth import SocketIdentity, may_watch_clinic


class TestPasswords:
    def test_hash_is_not_the_password(self):
        hashed = get_password_hash("Medicare@2026")
        assert hashed != "Medicare@2026"
        assert verify_password("Medicare@2026", hashed)

    def test_wrong_password_is_rejected(self):
        hashed = get_password_hash("Medicare@2026")
        assert not verify_password("medicare@2026", hashed)

    def test_same_password_hashes_differently(self):
        """Salting: two hashes of one password must not match."""
        assert get_password_hash("same") != get_password_hash("same")


class TestEncryption:
    def test_round_trip(self):
        aadhaar = "123456789012"
        stored = encrypt(aadhaar)
        assert stored != aadhaar
        assert decrypt(stored) == aadhaar

    def test_empty_values_pass_through(self):
        assert encrypt(None) is None
        assert encrypt("") == ""

    def test_corrupt_ciphertext_raises_rather_than_returning_it(self):
        """Silently returning ciphertext is how bad data reaches a record."""
        with pytest.raises(DecryptionError):
            decrypt("not-real-ciphertext")

    def test_mask_keeps_only_the_last_four(self):
        assert mask("123456789012") == "••••••••9012"
        assert mask("abc") == "•••"
        assert mask("") == ""


class TestTokens:
    def test_access_token_carries_the_subject_and_role(self):
        import jwt

        from app.core.config import settings

        token = create_access_token("user-123", {"role": "doctor"})
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])

        assert payload["sub"] == "user-123"
        assert payload["role"] == "doctor"
        assert "exp" in payload

    def test_token_signed_with_another_key_is_rejected(self):
        import jwt

        token = create_access_token("user-123")
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, "a-different-secret", algorithms=["HS256"])


class TestClinicIsolation:
    def test_staff_may_watch_their_own_clinic(self):
        identity = SocketIdentity(user_id="u1", clinic_id="clinic-a", role="receptionist")
        assert may_watch_clinic(identity, "clinic-a")

    def test_staff_may_not_watch_another_clinic(self):
        identity = SocketIdentity(user_id="u1", clinic_id="clinic-a", role="receptionist")
        assert not may_watch_clinic(identity, "clinic-b")

    def test_super_admin_may_watch_any_clinic(self):
        identity = SocketIdentity(user_id="u1", clinic_id=None, role="super_admin")
        assert may_watch_clinic(identity, "clinic-b")

    def test_user_without_a_clinic_is_refused(self):
        identity = SocketIdentity(user_id="u1", clinic_id=None, role="doctor")
        assert not may_watch_clinic(identity, "clinic-a")


class TestProductionConfiguration:
    def test_production_rejects_placeholder_secrets(self):
        with pytest.raises(ValueError) as error:
            Settings(
                ENVIRONMENT="production",
                DEBUG=False,
                SECRET_KEY="change-me",
                JWT_SECRET_KEY="change-me",
                JWT_REFRESH_SECRET_KEY="change-me",
                ENCRYPTION_KEY="",
                _env_file=None,
            )
        assert "SECRET_KEY" in str(error.value)

    def test_production_requires_an_encryption_key(self):
        strong = "x" * 48
        with pytest.raises(ValueError) as error:
            Settings(
                ENVIRONMENT="production",
                DEBUG=False,
                SECRET_KEY=strong,
                JWT_SECRET_KEY=strong,
                JWT_REFRESH_SECRET_KEY=strong,
                ENCRYPTION_KEY="",
                _env_file=None,
            )
        assert "ENCRYPTION_KEY" in str(error.value)

    def test_development_tolerates_defaults(self):
        settings = Settings(ENVIRONMENT="development", _env_file=None)
        assert settings.SECRET_KEY in INSECURE_PLACEHOLDERS or settings.SECRET_KEY

    def test_production_never_echoes_otps(self):
        strong = "y" * 48
        settings = Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY=strong,
            JWT_SECRET_KEY=strong,
            JWT_REFRESH_SECRET_KEY=strong,
            ENCRYPTION_KEY="dGVzdC1rZXktZm9yLXVuaXQtdGVzdHMtMzJieXRlcw==",
            ALLOWED_ORIGINS="https://clinic.example.in",
            _env_file=None,
        )
        assert settings.OTP_DEBUG_RETURN is False
