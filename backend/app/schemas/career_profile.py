from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


# -------------------------
# Career Profile Creation
# -------------------------
class CareerProfileCreate(BaseModel):
    current_role: str
    years_of_experience: float
    expected_salary: float
    dream_role: str
    skills: list[str]
    certifications: list[str]


# -------------------------
# Career Profile Update
# -------------------------
class CareerProfileUpdate(BaseModel):
    current_role: str | None = None
    years_of_experience: float | None = None
    expected_salary: float | None = None
    dream_role: str | None = None
    skills: list[str] | None = None
    certifications: list[str] | None = None


# -------------------------
# Career Profile Response
# -------------------------
class CareerProfileResponse(BaseModel):
    id: UUID
    user_id: UUID

    current_role: str
    years_of_experience: float
    expected_salary: float
    dream_role: str
    skills: list[str]
    certifications: list[str]

    model_config = ConfigDict(from_attributes=True)