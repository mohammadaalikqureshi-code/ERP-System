"""Application settings.

Every value here can be overridden with an environment variable of the same
name (see `.env.example`). Nothing environment-specific is hardcoded anywhere
else in the codebase — if you need to change a limit, a key or a URL, change it
here or in the environment.
"""

from functools import lru_cache
from typing import List, Literal

from pydantic import computed_field, model_validator, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Placeholder values that ship in `.env.example`. The app refuses to start in
# production if any of them are still in use.
INSECURE_PLACEHOLDERS = {
    "change-me",
    "your-secret-key-change-in-production",
    "your-jwt-secret-key",
    "your-jwt-refresh-secret-key",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=True
    )

    # ---------------------------------------------------------------- general
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True
    APP_NAME: str = "MediCare ERP"
    API_V1_STR: str = "/api/v1"

    # ------------------------------------------------------------------ auth
    SECRET_KEY: str = "change-me"
    JWT_SECRET_KEY: str = "change-me"
    JWT_REFRESH_SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cookie that carries the refresh token. httpOnly, so JavaScript can never
    # read it; `secure` is forced on outside development.
    REFRESH_COOKIE_NAME: str = "refresh_token"
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    COOKIE_DOMAIN: str = ""

    # Fernet key used to encrypt data at rest (patient identifiers, API keys).
    # Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str = ""

    # -------------------------------------------------------------- database
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "clinic_erp"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/clinic_erp"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # ----------------------------------------------------------------- redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0
    REDIS_MAX_CONNECTIONS: int = 50

    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # ------------------------------------------------------------------- web
    # Comma-separated list of origins allowed to call the API from a browser.
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # ---------------------------------------------------- load & rate limits
    RATE_LIMIT_ENABLED: bool = True
    # Applied to every request, per client IP.
    RATE_LIMIT_PER_MINUTE: int = 300
    # Tighter limits for endpoints that are expensive or attractive to attack.
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 5
    RATE_LIMIT_OTP_PER_HOUR: int = 5
    RATE_LIMIT_AI_PER_MINUTE: int = 20
    # Requests are rejected with 503 once this many are already in flight.
    MAX_CONCURRENT_REQUESTS: int = 200
    REQUEST_TIMEOUT_SECONDS: int = 30
    SLOW_REQUEST_MS: int = 1000

    # ------------------------------------------------------------ pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # --------------------------------------------------------------- caching
    CACHE_ENABLED: bool = True
    CACHE_TTL_SECONDS: int = 60

    # --------------------------------------------------------------- uploads
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_UPLOAD_EXTENSIONS: str = ".pdf,.png,.jpg,.jpeg,.webp,.dcm,.doc,.docx"

    # ------------------------------------------------------------------- OTP
    OTP_LENGTH: int = 6
    OTP_TTL_SECONDS: int = 300
    OTP_MAX_ATTEMPTS: int = 5
    # In development the OTP is returned in the API response so you can log in
    # without an SMS gateway. Forced off in production.
    OTP_DEBUG_RETURN: bool = True

    # --------------------------------------------------------------- billing
    # Default GST percentage applied to bills. Each clinic can override this in
    # its own settings; this is only the fallback.
    DEFAULT_GST_PERCENT: float = 18.0
    CURRENCY: str = "INR"

    # -------------------------------------------------------------------- AI
    AI_ENABLED: bool = True
    AI_PROVIDER: Literal["anthropic"] = "anthropic"
    AI_MODEL: str = "claude-opus-5"
    # Optional platform-wide key. A clinic can store its own key instead, which
    # always takes priority. If neither is set, AI features report themselves
    # as unavailable rather than failing requests.
    AI_API_KEY: str = ""
    AI_MAX_TOKENS: int = 2000
    AI_TIMEOUT_SECONDS: int = 60
    AI_CHAT_HISTORY_LIMIT: int = 12

    # --------------------------------------------------- notification senders
    WHATSAPP_PROVIDER: Literal["mock", "meta"] = "mock"
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    SMS_PROVIDER: Literal["mock", "msg91"] = "mock"
    MSG91_API_KEY: str = ""
    MSG91_SENDER_ID: str = "MEDCRE"

    # --------------------------------------------------------------- helpers
    @computed_field
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @computed_field
    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @computed_field
    @property
    def upload_extensions(self) -> List[str]:
        return [
            ext.strip().lower()
            for ext in self.ALLOWED_UPLOAD_EXTENSIONS.split(",")
            if ext.strip()
        ]

    @computed_field
    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @computed_field
    @property
    def redis_url(self) -> str:
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @computed_field
    @property
    def cookie_secure(self) -> bool:
        """Only send the refresh cookie over HTTPS outside development."""
        return self.ENVIRONMENT in ("production", "staging")

    @model_validator(mode="after")
    def _enforce_production_safety(self) -> "Settings":
        """Refuse to boot with development defaults in production.

        Shipping placeholder secrets is the most common way a project like this
        gets compromised, so this is a hard failure rather than a warning.
        """
        if not self.is_production:
            return self

        problems: List[str] = []
        for name in ("SECRET_KEY", "JWT_SECRET_KEY", "JWT_REFRESH_SECRET_KEY"):
            value = getattr(self, name)
            if value in INSECURE_PLACEHOLDERS or len(value) < 32:
                problems.append(f"{name} must be a unique random value of at least 32 characters")

        if not self.ENCRYPTION_KEY:
            problems.append("ENCRYPTION_KEY must be set (a Fernet key) to encrypt data at rest")

        if self.DEBUG:
            problems.append("DEBUG must be False in production")

        if problems:
            raise ValueError("Unsafe production configuration:\n  - " + "\n  - ".join(problems))

        # OTPs must never be echoed back to clients in production.
        object.__setattr__(self, "OTP_DEBUG_RETURN", False)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
