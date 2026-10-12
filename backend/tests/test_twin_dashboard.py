import copy

import httpx
import pytest

from app.models import DecisionRun, TwinState
from app.services.twin_dashboard_service import number
from test_decisions import setup_decision
from test_wallet_sync import context, SNAPSHOT, response


def test_dashboard_requires_owner_and_does_not_create_state(context):
    client, factory, ids, headers = context
    url = f"/users/{ids[0]}/twin/dashboard"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=headers[1]).status_code == 403
    data = client.get(url, headers=headers[0]).json()
    assert data["financial"] is None and data["career"] is None and data["health"] is None
    assert data["skills"]["existing"] == [] and data["decisions"] == []
    assert not any(data["profiles_present"].values())
    with factory() as db:
        assert db.query(TwinState).count() == db.query(DecisionRun).count() == 0


def test_dashboard_saved_projections_and_live_progress(context):
    client, factory, ids, headers = context
    base, run = setup_decision(context)
    data = client.get(f"{base}/twin/dashboard", headers=headers[0]).json()
    assert data["financial"]["savings_rate"] == 20
    assert data["financial"]["risk_classification"] is None
    goal = data["goals"]["financial"][0]
    assert goal["progress_pct"] == 22.2
    assert goal["baseline_savings"] == 80000 and goal["alternative_savings"] == 92000
    assert goal["kind"] == "saved_projection" and goal["goal_met"] is True
    assert client.put(f"{base}/financial/", headers=headers[0], json={"current_savings": 45000}).status_code == 200
    updated = client.get(f"{base}/twin/dashboard", headers=headers[0]).json()
    assert updated["goals"]["financial"][0]["progress_pct"] == 50
    assert updated["decisions"] == data["decisions"]  # Saved predictions remain immutable.
    with factory() as db:
        assert db.query(DecisionRun).count() == 1


def test_dashboard_zero_income_and_unknown_currency(context):
    client, _, ids, headers = context
    base = f"/users/{ids[0]}"
    client.post(f"{base}/financial/", headers=headers[0], json={"monthly_income": 0, "monthly_expense": 0, "current_savings": 0, "investments": 0, "debts": 0})
    finance = client.get(f"{base}/twin/dashboard", headers=headers[0]).json()["financial"]
    assert finance["current_savings"] == 0
    assert finance["savings_rate"] is None and finance["currency"] is None
    assert finance["balance_label"] == "Available savings"
    client.put(f"{base}/financial/", headers=headers[0], json={"monthly_income": 100, "monthly_expense": 150})
    assert client.get(f"{base}/twin/dashboard", headers=headers[0]).json()["financial"]["savings_rate"] == -50


def test_wallet_provenance_mixed_currency_and_private_fields(context, monkeypatch):
    client, _, ids, headers = context
    base, _ = setup_decision(context)
    payload = copy.deepcopy(SNAPSHOT)
    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: response(payload))
    client.post(f"{base}/financial/sync", headers=headers[0], json={"wallet_token": "fixture-secret"})
    result = client.get(f"{base}/twin/dashboard", headers=headers[0])
    finance = result.json()["financial"]
    assert finance["source"] == "wallet" and finance["currency"] == "INR"
    assert finance["current_savings"] == 247374 and finance["wallet_synced_at"]
    for private in ["account_statements", "WALLET-99", "fixture-secret", "hashed_password", "test0@example.com"]:
        assert private not in result.text
    client.put(f"{base}/financial/", headers=headers[0], json={"current_savings": 10})
    assert client.get(f"{base}/twin/dashboard", headers=headers[0]).json()["financial"]["source"] == "manual_override_of_wallet"
    payload["financial_twin"]["accounts"].append({"currency": "USD", "balance": "30"})
    client.post(f"{base}/financial/sync", headers=headers[0], json={"wallet_token": "fixture-secret"})
    mixed = client.get(f"{base}/twin/dashboard", headers=headers[0]).json()
    assert mixed["financial"]["mixed_currency"] is True
    assert mixed["financial"]["savings_rate"] is None
    assert mixed["goals"]["financial"][0]["progress_pct"] is None


def test_saved_career_health_and_unavailable_models(context):
    client, _, ids, headers = context
    base = f"/users/{ids[0]}"
    client.put(base, headers=headers[0], json={"career_goal": "Data engineer", "dream_country": "India"})
    client.post(f"{base}/career/", headers=headers[0], json={"current_role": "Student", "dream_role": "Data engineer", "years_of_experience": 0, "expected_salary": 600000, "skills": ["Python", "SQL", "Python"], "certifications": []})
    client.post(f"{base}/health/", headers=headers[0], json={"height": 175, "weight": 70, "sleep_hours": 7, "exercise_days": 0})
    data = client.get(f"{base}/twin/dashboard", headers=headers[0]).json()
    assert data["person"]["career_goal"] == "Data engineer"
    assert data["career"]["readiness"]["kind"] == "heuristic"
    assert data["career"]["salary_prediction"] is None
    assert data["skills"]["existing"] == ["Python", "SQL"]
    assert data["skills"]["gap"] is None
    assert data["health"]["exercise_days"] == 0


@pytest.mark.parametrize("value", [None, True, "12", float("inf"), float("nan")])
def test_dashboard_invalid_numbers_remain_unknown(value):
    assert number(value) is None
