from __future__ import annotations

from uuid import UUID
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Money = Annotated[float, Field(ge=0, le=1e12, allow_inf_nan=False)]


class WalletSignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(..., min_length=8)


class WalletLoginRequest(BaseModel):
    email: EmailStr
    password: str


class WalletTokenRequest(BaseModel):
    wallet_token: str


class WalletAccountRequest(BaseModel):
    wallet_token: str
    name: str
    account_type: str = "PERSONAL"
    balance: float = 0
    currency: str = "INR"


# -------------------------
# Financial Profile Creation
# -------------------------
class FinancialProfileCreate(BaseModel):
    monthly_income: Money
    monthly_expense: Money
    current_savings: Money
    investments: Money
    debts: Money


# -------------------------
# Financial Profile Update
# -------------------------
class FinancialProfileUpdate(BaseModel):
    monthly_income: Money | None = None
    monthly_expense: Money | None = None
    current_savings: Money | None = None
    investments: Money | None = None
    debts: Money | None = None

    @field_validator("*")
    @classmethod
    def no_null_amounts(cls, value):
        if value is None:
            raise ValueError("Omit unchanged amounts instead of setting them to null.")
        return value


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
    wallet_snapshot: dict | None = None
    wallet_synced_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
