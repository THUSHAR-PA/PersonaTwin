"""Synthetic Wallet contract tests; no real accounts or credentials are used."""

import copy
from datetime import date

import httpx
import pytest

from app.models import DecisionRun, FinancialProfile, TwinState
from app.services.wallet_history_service import review_wallet_history
from test_wallet_sync import context
from test_decisions import setup_decision


def wallet_payload(months=24):
    now = date.today().year * 12 + date.today().month - 1
    rows = []
    for index in range(now - months, now):
        rows.append(
            {
                "month": f"{index // 12:04d}-{index % 12 + 1:02d}",
                "income": "50000",
                "expenses": "40000",
                "transaction_count": 10,
                "secret_reference": "DO_NOT_RETURN",
            }
        )
    return {
        "financial_twin": {
            "currency": "INR",
            "accounts": [{"currency": "INR", "account_number": "DO_NOT_RETURN"}],
            "monthly_cash_flow": rows,
            "transactions": [{"reference": "DO_NOT_RETURN"}],
        }
    }


def test_wallet_history_preview_is_owned_read_only_and_excludes_credentials(
    context, monkeypatch
):
    client, factory, ids, headers = context
    base, _ = setup_decision(context)
    with factory() as db:
        counts = (db.query(TwinState).count(), db.query(DecisionRun).count())
        original = (
            db.query(FinancialProfile).filter_by(user_id=ids[0]).one().monthly_expense
        )
    calls = []

    def get(url, **kwargs):
        calls.append((url, kwargs))
        return httpx.Response(
            200, json=wallet_payload(), request=httpx.Request("GET", url)
        )

    monkeypatch.setattr(httpx, "get", get)
    path = base + "/twin/finance/wallet-history"
    body = {"wallet_token": "synthetic-wallet-token"}
    assert client.post(path, json=body).status_code == 401
    assert client.post(path, headers=headers[1], json=body).status_code == 403
    assert calls == []
    result = client.post(path, headers=headers[0], json=body)
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["usable_months"] == 24
    assert calls[0][1]["params"]["months"] == 24
    assert date.fromisoformat(calls[0][1]["params"]["end_date"]) < date.today().replace(
        day=1
    )
    assert calls[0][1]["headers"]["Authorization"] == "Bearer synthetic-wallet-token"
    for private in [
        "DO_NOT_RETURN",
        "synthetic-wallet-token",
        "account_number",
        "transactions",
    ]:
        assert private not in result.text
    with factory() as db:
        assert (db.query(TwinState).count(), db.query(DecisionRun).count()) == counts
        assert (
            db.query(FinancialProfile).filter_by(user_id=ids[0]).one().monthly_expense
            == original
        )
    # Confirmation uses the existing owned import; only this action persists data.
    imported = client.post(
        base + "/decisions/history",
        headers=headers[0],
        json={
            "csv_text": data["csv_text"],
            "source_name": data["source_name"],
            "currency": data["currency"],
            "consent": True,
        },
    )
    assert imported.status_code == 201, imported.text
    analysis = client.get(base + "/twin/finance", headers=headers[0]).json()
    assert analysis["history"]["eligible"] is True
    assert analysis["history"]["months"] == 24
    assert analysis["risk"]["training_deficit_months"] == 0
    assert "surplus" in analysis["risk"]["reason"]


def test_zero_filled_wallet_buckets_are_not_training_observations():
    data = wallet_payload()
    data["financial_twin"]["monthly_cash_flow"][-7]["transaction_count"] = 0
    result = review_wallet_history(data)
    assert result["returned_months"] == 24 and result["usable_months"] == 6
    assert len(result["excluded_months"]) == 1
    data["financial_twin"]["monthly_cash_flow"][-1]["transaction_count"] = 0
    assert review_wallet_history(data)["usable_months"] == 0


@pytest.mark.parametrize("change", ["mixed", "nan", "duplicate", "no-monthly"])
def test_invalid_wallet_history_is_not_imported(change):
    payload = wallet_payload()
    if change == "mixed":
        payload["financial_twin"]["accounts"].append({"currency": "USD"})
    elif change == "nan":
        payload["financial_twin"]["monthly_cash_flow"][-1]["income"] = "nan"
    elif change == "duplicate":
        payload["financial_twin"]["monthly_cash_flow"].append(
            copy.deepcopy(payload["financial_twin"]["monthly_cash_flow"][-1])
        )
    else:
        del payload["financial_twin"]["monthly_cash_flow"]
    with pytest.raises(ValueError):
        review_wallet_history(payload)


def test_current_partial_month_does_not_enter_history():
    payload = wallet_payload()
    payload["financial_twin"]["monthly_cash_flow"].append(
        {
            "month": date.today().strftime("%Y-%m"),
            "income": 100,
            "expenses": 200,
            "transaction_count": 4,
        }
    )
    assert review_wallet_history(payload)["usable_months"] == 24


def test_wallet_auth_failure_does_not_expire_personatwin_session(context, monkeypatch):
    client, _, ids, headers = context
    monkeypatch.setattr(
        httpx,
        "get",
        lambda url, **kwargs: httpx.Response(401, request=httpx.Request("GET", url)),
    )
    path = f"/users/{ids[0]}/twin/finance/wallet-history"
    result = client.post(
        path, headers=headers[0], json={"wallet_token": "expired-test-token"}
    )
    assert result.status_code == 409
    assert "Reconnect Wallet" in result.json()["detail"]
    assert (
        client.get(f"/users/{ids[0]}/twin/finance", headers=headers[0]).status_code
        == 200
    )
