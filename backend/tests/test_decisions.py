import copy
from datetime import date
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.models import DecisionEvent, DecisionRun, TwinState
from app.schemas.decision import DecisionRequest
from app.services.decision_service import evaluate_decision
from app.services.forecast_service import forecast_expenses
from app.services.twin_state_service import parse_monthly_history
from test_wallet_sync import context


STATE = {"currency": "INR", "financial": {"monthly_income": 50000, "monthly_expense": 40000, "current_savings": 20000}, "monthly_history": []}


def request(**kwargs):
    return DecisionRequest(state_id=uuid4(), target_amount=90000, months=6, monthly_reduction=2000, forecast="profile", **kwargs)


def setup_decision(context):
    client, factory, ids, headers = context
    base = f"/users/{ids[0]}"
    profile = {**STATE["financial"], "investments": 0, "debts": 0}
    assert client.post(f"{base}/financial/", headers=headers[0], json=profile).status_code == 201
    state = client.post(f"{base}/decisions/states", headers=headers[0], json={"currency": "INR"})
    assert state.status_code == 201, state.text
    payload = request().model_dump(mode="json")
    payload["state_id"] = state.json()["id"]
    response = client.post(f"{base}/decisions/", headers=headers[0], json=payload)
    assert response.status_code == 201, response.text
    return base, response.json()


def test_savings_counterfactual_and_contributions():
    result = evaluate_decision(STATE, request(), date(2026, 10, 5))
    assert result["baseline"]["final_savings"] == 80000
    assert result["alternative"]["final_savings"] == 92000
    assert not result["baseline"]["goal_met"] and result["alternative"]["goal_met"]
    assert result["trajectory"][0]["period_end"] == "2026-11-30"
    assert result["trajectory"][-1]["period_end"] == "2027-04-30"
    assert sum(c["amount"] for c in result["contributions"]) == result["difference"]
    assert result["counterfactual"]["verified"]
    assert result["counterfactual"]["result"] >= 90000


def test_career_uses_current_income_and_gap():
    result = evaluate_decision(STATE, request(scenario="job_switch", target_monthly_income=60000, transition_cost=10000, gap_months=2))
    # 20k cash - 10k transition + 4 * 60k income - 6 * 38k expenses.
    assert result["alternative"]["final_savings"] == 22000
    assert result["baseline"]["final_savings"] == 80000
    assert sum(c["amount"] for c in result["contributions"]) == result["difference"]
    assert any("deficit" in r["action"] for r in result["recommendations"])


def test_lifestyle_cost_and_disclosure():
    result = evaluate_decision(STATE, request(scenario="lifestyle", monthly_lifestyle_cost=1000, weekly_activity_hours=3))
    assert result["alternative"]["final_savings"] == 86000
    assert any("not a medical prediction" in w for w in result["warnings"])


@pytest.mark.parametrize("change", [{"months": 0}, {"months": 1.5}, {"target_amount": float("nan")}, {"target_amount": float("inf")}, {"seed": -1}, {"scenario": "job_switch"}, {"gap_months": 2}, {"monthly_lifestyle_cost": 10}])
def test_invalid_request(change):
    payload = {"state_id": uuid4(), "target_amount": 90000, **change}
    with pytest.raises(ValidationError):
        DecisionRequest(**payload)


def test_unknown_values_and_impossible_reduction():
    for value in [None, float("nan"), -1]:
        state = copy.deepcopy(STATE)
        state["financial"]["monthly_income"] = value
        with pytest.raises(ValueError):
            evaluate_decision(state, request())
    state = copy.deepcopy(STATE)
    state["financial"]["monthly_expense"] = 1000
    with pytest.raises(ValueError):
        evaluate_decision(state, request())


def test_mixed_currency_rejected_and_unsupported_currency_rejected():
    for change in [{"mixed_currency": True}, {"currency": "unknown"}]:
        with pytest.raises(ValueError):
            evaluate_decision({**STATE, **change}, request())


def test_seeded_simulation_and_zero_uncertainty():
    pytest.importorskip("numpy")
    result = evaluate_decision(STATE, request(uncertainty_pct=20))
    assert result == evaluate_decision(STATE, request(uncertainty_pct=20))
    band = result["uncertainty"]["alternative"]
    assert all(low <= mid <= high for low, mid, high in zip(band["p10"], band["p50"], band["p90"]))
    assert 0 <= band["goal_probability"] <= 1
    assert band["goal_probability"] >= result["uncertainty"]["baseline"]["goal_probability"]
    deterministic = evaluate_decision(STATE, request())
    assert deterministic["uncertainty"] is None
    assert deterministic["alternative"]["final_savings"] == 92000


def history(values):
    current = date.today().year * 12 + date.today().month - 1
    return [{"month": f"{(current - len(values) + i) // 12:04d}-{(current - len(values) + i) % 12 + 1:02d}", "income": 50000, "expense": v} for i, v in enumerate(values)]


def test_trained_forecast_evaluation_and_faithful_attribution():
    pytest.importorskip("sklearn")
    result = forecast_expenses(history([10000 + i * 1000 for i in range(18)]), 27000, 6)
    assert result["method"] == "ridge_trend"
    assert result["evaluation"]["model_mae"] < result["evaluation"]["baseline_mae"] * .95
    assert sum(a["contribution"] for a in result["attribution"]) == pytest.approx(result["values"][0])
    assert len(result["evaluation"]["observations"]) == 3
    constant = forecast_expenses(history([10000] * 18), 10000, 6)
    assert constant["method"] == "trailing_mean"
    assert not constant["evaluation"]["accepted"]
    short = forecast_expenses(history([10000] * 6), 12000, 6)
    assert short["method"] == "profile_assumption"
    assert short["values"] == [12000] * 6


def test_csv_validation():
    assert parse_monthly_history("month,income,expense\n2024-01,100,50\n2024-02,120,60")[1]["expense"] == 60
    for text in ["month,income,expense\n2024-01,100,nan", "month,income,expense\n2024-01,100,50\n2024-03,120,60", "month,income,expense\n2024-01,100,50\n2024-01,120,60", "month,income,expense\n2099-01,1,1", "month,income,expense\n2024-01,1,1,extra", "month,income,expense"]:
        with pytest.raises(ValueError):
            parse_monthly_history(text)


def test_saved_runs_immutable_and_private(context):
    base, run = setup_decision(context)
    client, factory, ids, headers = context
    client.put(f"{base}/financial/", headers=headers[0], json={"current_savings": 99999})
    loaded = client.get(f"{base}/decisions/{run['id']}", headers=headers[0])
    assert loaded.json()["result"] == run["result"]
    for path in [f"{base}/decisions/", f"{base}/decisions/states", f"{base}/decisions/{run['id']}"]:
        assert client.get(path).status_code == 401
        assert client.get(path, headers=headers[1]).status_code == 403
    own_path = f"/users/{ids[1]}/decisions/{run['id']}"
    assert client.get(own_path, headers=headers[1]).status_code == 404
    assert client.post(own_path + "/feedback", headers=headers[1], json={"choice": "accepted"}).status_code == 404
    feedback = client.post(f"{base}/decisions/{run['id']}/feedback", headers=headers[0], json={"choice": "accepted", "note": "Review essential costs first"})
    assert feedback.json()["events"][0]["data"]["choice"] == "accepted"
    with factory() as db:
        assert db.query(TwinState).filter_by(user_id=ids[0]).count() >= 2


def test_import_consent_currency_and_historical_capture(context):
    base, run = setup_decision(context)
    client, _, _, headers = context
    payload = {"csv_text": "month,income,expense\n2024-01,50000,40000", "source_name": "Test fixture", "currency": "INR", "consent": True}
    result = client.post(f"{base}/decisions/history", headers=headers[0], json=payload)
    assert result.status_code == 201
    assert result.json()["data"]["monthly_history"][0]["expense"] == 40000
    payload["consent"] = False
    assert client.post(f"{base}/decisions/history", headers=headers[0], json=payload).status_code == 422
    assert client.get(f"{base}/decisions/{run['id']}", headers=headers[0]).json()["result"]["forecast"]["history_months"] == 0


def test_profile_rejects_null_and_nonfinite_update(context):
    base, _ = setup_decision(context)
    client, _, _, headers = context
    for value in [None, "nan", "inf", -1]:
        assert client.put(f"{base}/financial/", headers=headers[0], json={"monthly_income": value}).status_code == 422


def test_outcome_requires_completed_exact_period(context):
    base, run = setup_decision(context)
    client, factory, _, headers = context
    path = f"{base}/decisions/{run['id']}/outcomes"
    assert client.post(path, headers=headers[0], json={"month": 1, "observed_on": run["result"]["trajectory"][0]["period_end"], "savings": 31000}).status_code == 422
    with factory() as db:
        stored = db.get(DecisionRun, UUID(run["id"]))
        saved = copy.deepcopy(stored.result)
        saved["trajectory"][0]["period_end"] = "2024-01-31"
        stored.result = saved
        db.commit()
    result = client.post(path, headers=headers[0], json={"month": 1, "observed_on": "2024-01-31", "savings": 31000})
    assert result.status_code == 201
    assert result.json()["events"][0]["data"]["error"] == -1000
    summary = result.json()["outcome_evaluation"]["branches"]["alternative"]
    assert summary["count"] == 1
    assert summary["mae"] == 1000
    corrected = client.post(path, headers=headers[0], json={"month": 1, "observed_on": "2024-01-31", "savings": 32000})
    assert corrected.status_code == 201
    detail = client.get(f"{base}/decisions/{run['id']}", headers=headers[0]).json()
    assert len(detail["events"]) == 2
    assert detail["outcome_evaluation"]["branches"]["alternative"]["count"] == 1
    assert detail["outcome_evaluation"]["branches"]["alternative"]["mae"] == 0
    assert detail["result"] == saved
    assert client.get(f"{base}/decisions/{run['id']}", headers=headers[1]).status_code == 403


def test_profile_boundaries_and_account_deletion(context):
    base, _ = setup_decision(context)
    client, factory, ids, headers = context
    for suffix in ["", "/career/", "/health/"]:
        assert client.get(base + suffix).status_code == 401
        assert client.get(base + suffix, headers=headers[1]).status_code == 403
        assert client.put(base + suffix, headers=headers[1], json={}).status_code in (403, 422)
    listing = client.get("/users/", headers=headers[0]).json()
    assert [u["id"] for u in listing] == [str(ids[0])]
    assert client.delete(base, headers=headers[0]).status_code == 204
    with factory() as db:
        assert db.query(DecisionRun).count() == 0
        assert db.query(TwinState).filter_by(user_id=ids[0]).count() == 0
        assert db.query(DecisionEvent).count() == 0
