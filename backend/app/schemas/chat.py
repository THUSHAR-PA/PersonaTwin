from typing import Literal
from pydantic import Field, field_validator
from app.schemas.decision import StrictInput

FIELDS = Literal[
    "price",
    "cheaper_price",
    "months",
    "delay_months",
    "down_payment",
    "annual_rate",
    "loan_months",
    "monthly_reduction",
    "target_amount",
    "target_monthly_income",
    "gap_months",
    "transition_cost",
    "reserve_months",
    "running_cost",
]


class ExtractedValue(StrictInput):
    field: FIELDS
    value: float = Field(ge=0, le=1e12)
    evidence: str = Field(min_length=1, max_length=200)


class ChatIntent(StrictInput):
    scenario: Literal["purchase", "savings", "job_switch", "summary", "unsupported"]
    new_topic: bool = False
    updates: list[ExtractedValue] = Field(default_factory=list, max_length=15)
    response_kind: Literal["compare", "explain", "conditions"] = "compare"
    clarification: Literal[
        "none",
        "monthly_income",
        "time_units",
        "multiple_decisions",
        "ambiguous_amount",
        "currency_change",
    ] = "none"


class ChatCreateRequest(StrictInput):
    currency: Literal["INR", "USD", "EUR", "GBP"] = "INR"


class ChatMessageRequest(StrictInput):
    message: str = Field(min_length=1, max_length=2000)
    version: int = Field(ge=0, strict=True)

    @field_validator("message")
    @classmethod
    def nonempty_message(cls, value):
        if not value.strip():
            raise ValueError("Enter a question before sending.")
        return value.strip()
