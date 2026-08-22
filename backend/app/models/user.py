from sqlalchemy import Column, String, Boolean, ForeignKey, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel, SoftDeleteMixin

class Role(BaseModel):
    __tablename__ = "roles"
    name = Column(String, unique=True, nullable=False)
    permissions = Column(JSON, nullable=False, default=[])
    description = Column(String, nullable=True)
    
    users = relationship("User", back_populates="role")

class User(BaseModel, SoftDeleteMixin):
    __tablename__ = "users"
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=True)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    otp_secret = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    role = relationship("Role", back_populates="users")
    clinic = relationship("Clinic")
    branch = relationship("Branch", back_populates="users")
