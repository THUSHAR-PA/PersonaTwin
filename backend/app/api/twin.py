from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import ensure_user_owns_resource, get_current_user
from app.models.user import User
from app.services.career_service import get_career_profile
from app.services.finance_service import get_financial_profile
from app.services.health_service import get_health_profile
from app.services.user_service import get_user_by_id
from app.twin.digital_twin import DigitalTwin

router = APIRouter(prefix="/users/{user_id}/twin", tags=["Digital Twin"])


class TwinSimulationRequest(BaseModel):
    scenario: str
    parameters: dict[str, Any] = Field(default_factory=dict)


@router.get("/")
def get_twin_summary(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_user_owns_resource(user_id, current_user)

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    financial = get_financial_profile(db, user_id) or {}
    career = get_career_profile(db, user_id) or {}
    health = get_health_profile(db, user_id) or {}

    twin = DigitalTwin().sync(
        user={
            "full_name": user.full_name,
            "career_goal": user.career_goal,
            "education": user.education,
        },
        financial_profile={
            "monthly_income": getattr(financial, "monthly_income", 0),
            "monthly_expense": getattr(financial, "monthly_expense", 0),
            "current_savings": getattr(financial, "current_savings", 0),
            "debts": getattr(financial, "debts", 0),
            "wallet_snapshot": getattr(financial, "wallet_snapshot", None),
        },
        career_profile={
            "years_of_experience": getattr(career, "years_of_experience", 0),
            "expected_salary": getattr(career, "expected_salary", 0),
            "dream_role": getattr(career, "dream_role", ""),
            "skills": getattr(career, "skills", []),
        },
        health_profile={
            "sleep_hours": getattr(health, "sleep_hours", 0),
            "exercise_days": getattr(health, "exercise_days", 0),
        },
    )

    return {
        "name": twin.name,
        "career_score": twin.career_score,
        "finance_score": twin.finance_score,
        "learning_score": twin.learning_score,
        "profile_summary": twin.profile_summary,
        "prediction": twin.predict(),
        "financial_twin": (getattr(financial, "wallet_snapshot", None) or {}).get("financial_twin"),
        "wallet_synced_at": getattr(financial, "wallet_synced_at", None),
    }


@router.post("/simulate")
def run_twin_simulation(
    user_id: UUID,
    payload: TwinSimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_user_owns_resource(user_id, current_user)

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    financial = get_financial_profile(db, user_id) or {}
    career = get_career_profile(db, user_id) or {}
    health = get_health_profile(db, user_id) or {}

    twin = DigitalTwin().sync(
        user={
            "full_name": user.full_name,
            "career_goal": user.career_goal,
            "education": user.education,
        },
        financial_profile={
            "monthly_income": getattr(financial, "monthly_income", 0),
            "monthly_expense": getattr(financial, "monthly_expense", 0),
            "current_savings": getattr(financial, "current_savings", 0),
            "debts": getattr(financial, "debts", 0),
            "wallet_snapshot": getattr(financial, "wallet_snapshot", None),
        },
        career_profile={
            "years_of_experience": getattr(career, "years_of_experience", 0),
            "expected_salary": getattr(career, "expected_salary", 0),
            "dream_role": getattr(career, "dream_role", ""),
            "skills": getattr(career, "skills", []),
        },
        health_profile={
            "sleep_hours": getattr(health, "sleep_hours", 0),
            "exercise_days": getattr(health, "exercise_days", 0),
        },
    )

    return twin.simulate(payload.scenario, **payload.parameters)

