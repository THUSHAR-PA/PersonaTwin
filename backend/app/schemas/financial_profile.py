from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


# -------------------------
# Financial Profile Creation
# -------------------------
class FinancialProfileCreate(BaseModel):
    monthly_income: float
    monthly_expense: float
    current_savings: float
    investments: float
    debts: float


# -------------------------
# Financial Profile Update
# -------------------------
class FinancialProfileUpdate(BaseModel):
    monthly_income: float | None = None
    monthly_expense: float | None = None
    current_savings: float | None = None
    investments: float | None = None
    debts: float | None = None


# -------------------------
# Financial Profile Response
# -------------------------
class FinancialProfileResponse(BaseModel):
    id: UUID
    user_id: UUID

    monthly_income: float
    monthly_expense: float
    current_savings: float
    investments: float
    debts: float

    model_config = ConfigDict(from_attributes=True)