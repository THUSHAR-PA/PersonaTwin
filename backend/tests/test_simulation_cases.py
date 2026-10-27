from uuid import uuid4
import pytest
from app.schemas.decision import DecisionRequest
from app.services.decision_service import evaluate_decision
from app.services.chat_simulation import answer

STATE = {"currency": "INR", "financial": {"monthly_income": 50000, "monthly_expense": 40000, "current_savings": 20000}, "monthly_history": []}

@pytest.mark.parametrize("scenario,extra", [("savings_goal", {}), ("job_switch", {"target_monthly_income": 60000, "gap_months": 2, "transition_cost": 10000}), ("higher_studies", {"target_monthly_income": 60000}), ("lifestyle", {"monthly_lifestyle_cost": 1000})])
def test_saved_cases(scenario, extra):
    result = evaluate_decision(STATE, DecisionRequest(state_id=uuid4(), target_amount=90000, months=6, monthly_reduction=2000, forecast="profile", scenario=scenario, **extra))
    current, worst, best, alternative = result["cases"]
    assert [c["id"] for c in result["cases"]] == ["current", "worst", "best", "alternative"]
    assert current["final_savings"] == result["baseline"]["final_savings"]
    assert alternative["final_savings"] == result["alternative"]["final_savings"]
    assert worst["final_savings"] == alternative["final_savings"] - 48000
    assert best["final_savings"] == alternative["final_savings"] + 48000
    assert all(len(c["trajectory"]) == 6 for c in result["cases"])

@pytest.mark.parametrize("plan", [
    {"scenario": "purchase", "price": 100000, "running_cost": 1000, "months": 1},
    {"scenario": "savings", "target_amount": 90000, "monthly_reduction": 40000, "months": 12},
    {"scenario": "job_switch", "target_monthly_income": 60000, "gap_months": 0, "transition_cost": 0},
])
def test_chat_cases(plan):
    result = answer(STATE, plan)["comparison"]
    current, worst, best, alternative = result["cases"]
    assert current["final_savings"] == result["options"][0]["final_cash"]
    assert worst["final_savings"] <= alternative["final_savings"] <= best["final_savings"]
    assert len(current["trajectory"]) == result["months"]

@pytest.mark.parametrize("variation", [0, 20, 50])
def test_zero_expenses(variation):
    state = {**STATE, "financial": {**STATE["financial"], "monthly_expense": 0}}
    result = evaluate_decision(state, DecisionRequest(state_id=uuid4(), target_amount=0, case_expense_variation_pct=variation))
    assert len({c["final_savings"] for c in result["cases"]}) == 1
