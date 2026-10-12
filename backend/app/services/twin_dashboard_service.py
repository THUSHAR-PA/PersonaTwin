"""Read-only presentation of existing profiles and saved decisions.

No model calls, wallet credentials, account statements, new predictions, or writes.
Unknown values stay null; a missing profile is never a zero-valued profile.
"""

import math
from datetime import datetime, timezone

from app.models import DecisionRun, User
from app.services.twin_state_service import current_state_data
from app.twin.digital_twin import DigitalTwin


def number(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return value
    return None


def strings(value):
    return list(dict.fromkeys(item.strip() for item in value if isinstance(item, str) and item.strip())) if isinstance(value, list) else []


def decision_summary(run):
    result = run.result
    trajectory = result.get("trajectory") or []
    return {
        "id": str(run.id), "title": run.request.get("title"),
        "scenario": run.scenario, "created_at": run.created_at,
        "currency": result.get("currency"), "months": run.request.get("months"),
        "target_amount": number(result.get("target_amount")),
        "baseline_savings": number(result.get("baseline", {}).get("final_savings")),
        "alternative_savings": number(result.get("alternative", {}).get("final_savings")),
        "difference": number(result.get("difference")),
        "goal_met": result.get("alternative", {}).get("goal_met"),
        "period_end": trajectory[-1].get("period_end") if trajectory else None,
        "kind": "saved_projection",
    }


def get_dashboard(db, user_id):
    user = db.get(User, user_id)
    state = current_state_data(db, user_id)
    financial, career, health = (state[key] for key in ("financial", "career", "health"))
    currency = state["currency"]
    runs = db.query(DecisionRun).filter_by(user_id=user_id).order_by(DecisionRun.created_at.desc()).limit(6).all()
    goal_runs = db.query(DecisionRun).filter_by(user_id=user_id, scenario="savings_goal").order_by(DecisionRun.created_at.desc()).limit(4).all()

    finance_data = None
    if financial is not None:
        values = {key: number(value) for key, value in financial.items()}
        income, expense = values["monthly_income"], values["monthly_expense"]
        rate = number((income - expense) / income * 100) if income and expense is not None and not state["mixed_currency"] else None
        finance_data = {
            **values, "currency": currency, "mixed_currency": state["mixed_currency"],
            "source": state["financial_source"], "wallet_synced_at": state["wallet_synced_at"],
            "balance_label": "Total cash balance" if state["financial_source"] == "wallet" else "Available savings",
            "savings_rate": round(rate, 1) if rate is not None else None,
            "savings_rate_basis": "(monthly income − monthly expenses) / monthly income × 100. Unavailable for zero income or mixed currencies.",
            "risk_classification": None,
            "risk_note": "A financial risk model is not connected to this application.",
        }

    career_data = None
    if career is not None:
        # Reuse the existing heuristic, without presenting it as a learned model.
        safe_career = {**career, "years_of_experience": number(career.get("years_of_experience")), "expected_salary": number(career.get("expected_salary"))}
        score = DigitalTwin().sync(user={"career_goal": user.career_goal}, career_profile=safe_career).career_score
        career_data = {
            "current_role": career.get("current_role"), "dream_role": career.get("dream_role"),
            "years_of_experience": safe_career["years_of_experience"],
            "expected_salary": safe_career["expected_salary"],
            "readiness": {"value": round(score, 1), "kind": "heuristic", "basis": "Existing PersonaTwin score: experience, entered salary expectation, dream role and career goal. Not validated job readiness."},
            "salary_prediction": None, "opportunities": None,
            "prediction_note": "Trained salary and opportunity predictions are not connected. Expected salary is user-entered; its currency and pay period are not recorded.",
        }

    goals = []
    for run in goal_runs:
        goal = decision_summary(run)
        target = goal["target_amount"]
        cash = finance_data["current_savings"] if finance_data else None
        same_currency = bool(currency and currency == goal["currency"] and not state["mixed_currency"])
        progress = max(0, min(100, cash / target * 100)) if cash is not None and target and target > 0 and same_currency else None
        goals.append({**goal, "progress_pct": round(progress, 1) if progress is not None else None,
                      "progress_basis": "Current available savings / this saved simulation's target. Savings are not allocated to this goal; goals may overlap."})

    return {
        "schema_version": "1.0", "refreshed_at": datetime.now(timezone.utc),
        "person": {"full_name": user.full_name, "career_goal": user.career_goal, "dream_country": user.dream_country},
        "profiles_present": {"financial": financial is not None, "career": career is not None, "health": health is not None},
        "financial": finance_data, "career": career_data,
        "skills": {"existing": strings(career.get("skills")) if career else [], "gap": None, "alignment": None, "learning_priorities": None,
                   "note": "Skills come from your saved profile, including any GitHub sync. A role-specific skill-gap model and learning recommendations are not connected."},
        "health": {key: number(value) for key, value in health.items()} if health is not None else None,
        "goals": {"financial": goals, "note": "Financial goals are targets from your latest four saved savings simulations. Personal goal deadlines and career milestone tracking are not recorded yet."},
        "decisions": [decision_summary(run) for run in runs],
    }
