from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


# -------------------------
# User Registration Schema
# -------------------------
class UserCreate(BaseModel):
    full_name: str
    email: EmailStr


# -------------------------
# User Profile Update Schema
# -------------------------
class UserUpdate(BaseModel):
    age: int | None = None
    gender: str | None = None
    country: str | None = None
    education: str | None = None
    university: str | None = None
    cgpa: float | None = None
    career_goal: str | None = None
    dream_country: str | None = None
    risk_tolerance: str | None = None


# -------------------------
# User Response Schema
# -------------------------
class UserResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr

    age: int | None = None
    gender: str | None = None
    country: str | None = None
    education: str | None = None
    university: str | None = None
    cgpa: float | None = None
    career_goal: str | None = None
    dream_country: str | None = None
    risk_tolerance: str | None = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)