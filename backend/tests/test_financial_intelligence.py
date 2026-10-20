"""Synthetic behavioural tests. Passing these does not establish real-world ML quality."""

import copy
import math
from datetime import date

import pytest

from app.models import DecisionRun, FinancialProfile, TwinState
from app.services.finance_ml import (
    checked_history,
    cashflow_forecast,
    shortfall_model,
    spending_model,
    _features,
)
from app.services.financial_intelligence_service import analyze
from test_decisions import setup_decision, history
from test_wallet_sync import context


def state(rows=None):
    return {
        "currency": "INR",
        "financial_source": "manual_profile",
        "financial": {
            "monthly_income": 50000,
            "monthly_expense": 40000,
            "current_savings": 20000,
            "investments": 5000,
            "debts": 10000,
        },
        "monthly_history": rows or [],
        "history_source": {
            "kind": "user_monthly_csv",
            "name": "Synthetic reviewed totals",
        },
    }


def test_finance_ownership_empty_and_read_only(context):
    client, factory, ids, headers = context
    path = f"/users/{ids[0]}/twin/finance"
    assert client.get(path).status_code == 401
    assert client.get(path, headers=headers[1]).status_code == 403
    assert (
        client.post(path + "/analyze", headers=headers[1], json={}).status_code == 403
    )
    result = client.get(path, headers=headers[0])
    assert result.status_code == 200, result.text
    data = result.json()
    assert (
        data["summary"]["cash"] is None
        and data["summary"]["recorded_net_assets"] is None
    )
    assert data["timeline"] == [] and data["risk"]["probability"] is None
    assert data["history"]["eligible"] is False
    with factory() as db:
        assert db.query(TwinState).count() == db.query(DecisionRun).count() == 0


def test_scenario_and_current_goal_projection_do_not_rewrite_saved_data(context):
    client, factory, ids, headers = context
    base, saved = setup_decision(context)
    with factory() as db:
        before = db.query(TwinState).count()
    result = client.post(
        base + "/twin/finance/analyze",
        headers=headers[0],
        json={"monthly_debt_payment": 4000},
    )
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["debt_stress"]["payment_to_income_pct"] == 8
    assert data["debt_stress"]["stressed_payment_to_income_pct"] == 10
    assert (
        data["timeline"][0]["savings"] == 30000
    )  # EMI is NOT subtracted from expenses again.
    assert data["timeline"][-1]["savings"] == 140000
    assert data["goals"][0]["progress_pct"] == 22.2
    assert data["goals"][0]["achievement_month"]
    assert (
        data["goals"][0]["original_deadline"]
        == saved["result"]["trajectory"][-1]["period_end"]
    )
    assert (
        client.get(base + f"/decisions/{saved['id']}", headers=headers[0]).json()[
            "result"
        ]
        == saved["result"]
    )
    with factory() as db:
        assert db.query(TwinState).count() == before
        assert db.query(DecisionRun).count() == 1


@pytest.mark.parametrize("payment", [-1, 1e13, True, "123"])
def test_invalid_scenario_inputs(context, payment):
    client, _, ids, headers = context
    assert (
        client.post(
            f"/users/{ids[0]}/twin/finance/analyze",
            headers=headers[0],
            json={"monthly_debt_payment": payment},
        ).status_code
        == 422
    )


def test_missing_currency_mixed_and_stale_history_never_activate_ml():
    rows = history([10000 + i * 1000 for i in range(30)])
    for changes in [
        {"currency": None},
        {"mixed_currency": True},
        {"history_source": None},
    ]:
        result = analyze({**state(rows), **changes}, {}, {})
        assert not result["history"]["eligible"]
        assert result["risk"]["probability"] is None
        assert result["behaviour"]["status"] != "ready"
        if changes.get("currency", "INR") is None or changes.get("mixed_currency"):
            assert result["timeline"] == []
    result = analyze(state(rows[:-1]), {}, {})
    assert not result["history"]["eligible"]
    assert "stale" in result["history"]["issue"]
    assert result["forecasts"]["expense"]["method"] == "profile_assumption"


@pytest.mark.parametrize(
    "bad",
    [
        [{"month": "2024-01", "income": True, "expense": 3}],
        [{"month": "2024-01", "income": 4, "expense": float("nan")}],
        [
            {"month": "2024-01", "income": 4, "expense": 3},
            {"month": "2024-03", "income": 4, "expense": 3},
        ],
        [{"month": "2099-01", "income": 4, "expense": 3}],
        [None],
    ],
)
def test_bad_history_is_rejected_not_zero_filled(bad):
    rows, issue = checked_history(bad, date.today())
    assert rows == [] and issue


def test_wallet_aggregates_whitelist_and_coverage_not_training_data(context):
    client, factory, ids, headers = context
    base, _ = setup_decision(context)
    wallet = {
        "currency": "INR",
        "metrics": {"declared_monthly_emi": "6000", "months_with_activity": 2},
        "period": {"start": "2026-05-01", "end": "2026-10-02"},
        "category_spend": [
            {"category": "FOOD", "amount": "15000", "account_number": "SECRET-99"}
        ],
        "monthly_cash_flow": [{"month": "2026-09", "income": 0, "expenses": 0}],
        "data_quality": {"missing_months": ["2026-08"]},
        "transactions": [{"reference": "SECRET-99"}],
        "token": "PRIVATE_TOKEN",
    }
    with factory() as db:
        profile = db.query(FinancialProfile).filter_by(user_id=ids[0]).one()
        profile.wallet_snapshot = {"financial_twin": wallet}
        db.commit()
    result = client.get(base + "/twin/finance", headers=headers[0])
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["debt_stress"]["monthly_payment"] == 6000
    assert data["categories"] == [{"category": "FOOD", "amount": 15000}]
    assert data["history"]["months"] == 0
    assert data["wallet_quality"]["missing_months"] == ["2026-08"]
    for private in ["SECRET-99", "PRIVATE_TOKEN", "transactions", "account_number"]:
        assert private not in result.text


def test_income_and_expense_forecasts_are_independent_and_validated():
    rows = history([10000 + i * 1000 for i in range(24)])
    for index, row in enumerate(rows):
        row["income"] = 40000 + index * 2000
    income = cashflow_forecast(rows, 86000, "income", 12, date.today())
    expense = cashflow_forecast(rows, 33000, "expense", 12, date.today())
    assert income["method"] == expense["method"] == "ridge_trend"
    assert income["values"][0] > expense["values"][0]
    assert (
        income["evaluation"]["model_mae"] < income["evaluation"]["baseline_mae"] * 0.95
    )
    assert sum(row["contribution"] for row in income["attribution"]) == pytest.approx(
        income["values"][0]
    )
    assert "independent test" in income["evaluation"]["note"]


def test_risk_is_trained_with_a_gap_and_gated_against_baseline():
    rows = history([50000 + 15000 * math.sin(i * 0.45) for i in range(60)])
    result = shortfall_model(rows)
    assert result["status"] == "ready"
    assert 0 <= result["probability"] <= 1
    assert result["evaluation"]["brier"] < result["evaluation"]["baseline_brier"] * 0.95
    log_odds = result["explanation"]["intercept"] + sum(
        row["log_odds"] for row in result["explanation"]["factors"]
    )
    assert 1 / (1 + math.exp(-log_odds)) == pytest.approx(
        result["probability"], abs=0.00005
    )
    assert sum(sum(row) for row in result["evaluation"]["confusion_matrix"]) == 6
    assert shortfall_model(history([40000] * 30))["probability"] is None
    # Target month and the month immediately preceding it never enter its features.
    expected = _features(rows[:10])
    changed = copy.deepcopy(rows)
    changed[10]["expense"] = 1e10
    changed[11]["expense"] = 1e10
    assert _features(changed[:10]) == expected


def test_spending_detector_scores_unseen_month_and_zero_values():
    rows = history([20000] * 18 + [150000])
    result = spending_model(rows)
    assert result["unusual"] is True
    assert result["training_months"] == 18
    assert result["versus_previous_three_pct"] == 650
    assert spending_model(history([0] * 13))["versus_previous_three_pct"] is None
    assert spending_model(rows[:8])["status"] == "needs_data"


def test_goal_currency_separation_and_zero_income():
    data = state()
    data["financial"].update(
        monthly_income=0, monthly_expense=0, current_savings=0, debts=0
    )
    goals = {
        "goals": {
            "financial": [
                {"id": "usd", "currency": "USD", "target_amount": 100},
                {"id": "inr", "currency": "INR", "target_amount": 100},
            ]
        }
    }
    result = analyze(data, goals, {})
    assert result["summary"]["cash"] == 0
    assert result["summary"]["cash_runway_months"] is None
    assert result["summary"]["savings_rate"] is None
    assert result["debt_stress"]["payment_to_income_pct"] is None
    assert result["goals"][0]["status"] == "unavailable"
    assert result["goals"][1]["achievement_month"] is None
