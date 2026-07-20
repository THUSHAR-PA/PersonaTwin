from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


# -------------------------
# Health Profile Creation
# -------------------------
class HealthProfileCreate(BaseModel):
    height: float
    weight: float
    sleep_hours: float
    exercise_days: int


# -------------------------
# Health Profile Update
# -------------------------
class HealthProfileUpdate(BaseModel):
    height: float | None = None
    weight: float | None = None
    sleep_hours: float | None = None
    exercise_days: int | None = None


# -------------------------
# Health Profile Response
# -------------------------
class HealthProfileResponse(BaseModel):
    id: UUID
    user_id: UUID

    height: float
    weight: float
    sleep_hours: float
    exercise_days: int

    model_config = ConfigDict(from_attributes=True)