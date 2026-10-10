from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

Amount = Annotated[float, Field(ge=0, le=1e12, allow_inf_nan=False)]


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class CaptureRequest(StrictInput):
    currency: Literal["INR", "USD", "EUR", "GBP"] = "INR"


class HistoryImport(CaptureRequest):
    csv_text: str = Field(min_length=1, max_length=100000)
    source_name: str = Field(min_length=1, max_length=120)
    consent: Literal[True]


class DecisionRequest(StrictInput):
    state_id: UUID
    scenario: Literal["savings_goal", "job_switch", "higher_studies", "lifestyle"] = "savings_goal"
    title: str = Field(default="Savings goal", min_length=1, max_length=120)
    months: int = Field(default=12, ge=1, le=120, strict=True)
    target_amount: Amount
    monthly_reduction: Amount = 0
    forecast: Literal["profile", "auto"] = "auto"
    uncertainty_pct: float = Field(default=0, ge=0, le=50)
    seed: int = Field(default=42, ge=0, le=4294967295, strict=True)
    samples: int = Field(default=1000, ge=100, le=5000, strict=True)
    target_monthly_income: Amount | None = None
    transition_cost: Amount = 0
    gap_months: int = Field(default=0, ge=0, le=60, strict=True)
    monthly_lifestyle_cost: Amount = 0
    weekly_activity_hours: float = Field(default=0, ge=0, le=40)

    @model_validator(mode="after")
    def validate_scenario(self):
        if self.gap_months > self.months:
            raise ValueError("The transition cannot exceed the projection horizon.")
        if self.scenario in ("job_switch", "higher_studies") and self.target_monthly_income is None:
            raise ValueError("Enter the expected take-home monthly income after the transition.")
        if self.scenario not in ("job_switch", "higher_studies") and (self.gap_months or self.transition_cost or self.target_monthly_income is not None):
            raise ValueError("Transition assumptions apply only to career or education decisions.")
        if self.scenario != "lifestyle" and (self.monthly_lifestyle_cost or self.weekly_activity_hours):
            raise ValueError("Lifestyle assumptions apply only to lifestyle decisions.")
        return self


class FeedbackRequest(StrictInput):
    choice: Literal["accepted", "rejected", "considering"]
    note: str = Field(default="", max_length=2000)


class OutcomeRequest(StrictInput):
    month: int = Field(ge=1, le=120, strict=True)
    observed_on: date
    savings: Annotated[float, Field(ge=-1e12, le=1e12)]
    branch: Literal["baseline", "alternative"] = "alternative"
    note: str = Field(default="", max_length=2000)
