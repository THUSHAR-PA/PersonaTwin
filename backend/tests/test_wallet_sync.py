import copy
import os
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "isolated-personatwin-test-key-do-not-deploy"

from app.database.base import Base
from app.database.session import get_db
from app.auth.security import create_access_token
from app.main import app
from app.models import User, FinancialProfile
from app.services.finance_service import financial_values


@compiles(JSONB, "sqlite")
def sqlite_test_json(type_, compiler, **kw):
    return "JSON"


SNAPSHOT = {
    "user": {"id": 1, "username": "fictional"},
    "financial_twin": {
        "schema_version": "3.0", "currency": "INR",
        "analysis_source": "UNIFIED_BANK_LEDGER",
        "period": {"start": "2026-05-01", "end": "2026-10-02", "months": 6},
        "profile": {"monthly_salary": "90000", "investment_value": "420000"},
        "metrics": {"observed_monthly_income": "87500", "monthly_expenses": "65000",
                    "cash_balance": "247374", "total_outstanding_debt": "2630000",
                    "transaction_count": 235, "declared_monthly_income": "95000"},
        "accounts": [{"id": 10, "name": "Salary", "balance": "247374", "currency": "INR"}],
        "liabilities": [{"id": 1, "name": "Mortgage", "outstanding_amount": "2450000",
                         "annual_interest_rate": "8.5", "monthly_payment": "24500"}],
        "account_statements": [{"account_id": 10, "transactions": [
            {"id": 99, "reference": "WALLET-99", "direction": "OUTFLOW",
             "amount": "5000", "balance": "247374", "source": "TRANSFER"}
        ]}],
    },
}


@pytest.fixture
def context():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    ids = [uuid4(), uuid4()]
    with factory() as db:
        db.add_all([User(id=uid, full_name=f"Test {i}", email=f"test{i}@example.com") for i, uid in enumerate(ids)])
        db.commit()
    def override():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as client:
        yield client, factory, ids, [{"Authorization": f"Bearer {create_access_token(uid)}"} for uid in ids]
    app.dependency_overrides.clear()
    engine.dispose()


def response(payload, status=200):
    return httpx.Response(status, json=payload, request=httpx.Request("GET", "https://fictional-bank.invalid/integration/financial-summary"))


def test_sync_maps_bank_metrics_and_retains_complete_history(context, monkeypatch):
    client, factory, ids, headers = context
    payload = copy.deepcopy(SNAPSHOT)
    monkeypatch.setattr(httpx, "get", lambda *args, **kw: response(payload))
    url = f"/users/{ids[0]}/financial/sync"
    result = client.post(url, headers=headers[0], json={"wallet_token": "fictional-token"})
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["current_savings"] == 247374
    assert data["monthly_income"] == 87500
    assert data["monthly_expense"] == 65000
    assert data["investments"] == 420000 and data["debts"] == 2630000
    assert data["wallet_snapshot"] == payload
    assert data["wallet_synced_at"]
    payload["financial_twin"]["metrics"]["cash_balance"] = "246374"
    payload["financial_twin"]["accounts"][0]["balance"] = "246374"
    result = client.post(url, headers=headers[0], json={"wallet_token": "fictional-token"})
    assert result.json()["current_savings"] == 246374
    twin = client.get(f"/users/{ids[0]}/twin/", headers=headers[0]).json()
    assert twin["financial_twin"]["account_statements"] == payload["financial_twin"]["account_statements"]
    assert twin["profile_summary"]["current_savings"] == 246374
    assert twin["profile_summary"]["financial_twin"]["liabilities"][0]["name"] == "Mortgage"
    assert client.post(url, headers=headers[1], json={"wallet_token": "fictional-token"}).status_code == 403
    assert client.get(f"/users/{ids[0]}/financial/", headers=headers[1]).status_code == 403
    assert client.get(f"/users/{ids[0]}/financial/").status_code == 401
    with factory() as db:
        assert db.query(FinancialProfile).count() == 1


def test_failed_and_malformed_refresh_keep_last_successful_snapshot(context, monkeypatch):
    client, factory, ids, headers = context
    url = f"/users/{ids[0]}/financial/sync"
    monkeypatch.setattr(httpx, "get", lambda *args, **kw: response(SNAPSHOT))
    assert client.post(url, headers=headers[0], json={"wallet_token": "token"}).status_code == 200
    for payload, status, expected in [({"error": "offline"}, 500, 503), ({"metrics": {"total_balance": 0}}, 200, 503), ({}, 401, 401)]:
        monkeypatch.setattr(httpx, "get", lambda *args, **kw: response(payload, status))
        assert client.post(url, headers=headers[0], json={"wallet_token": "token"}).status_code == expected
        with factory() as db:
            profile = db.query(FinancialProfile).one()
            assert profile.current_savings == 247374
            assert profile.wallet_snapshot == SNAPSHOT


def test_income_falls_back_to_declared_only_without_activity():
    payload = copy.deepcopy(SNAPSHOT)
    payload["financial_twin"]["metrics"]["transaction_count"] = 0
    assert financial_values(payload)["monthly_income"] == 95000


@pytest.mark.parametrize("bad", [None, [], {}, {"financial_twin": {}}, {"monthly_income": "nan", "monthly_expense": 0, "current_savings": 0, "investments": 0, "debts": 0}])
def test_invalid_contract_is_never_zeroed(bad):
    with pytest.raises(RuntimeError):
        financial_values(bad)


def test_snapshot_migration_preserves_existing_financial_profile():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect, text
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE financial_profiles (id TEXT PRIMARY KEY, monthly_income FLOAT, current_savings FLOAT)"))
        connection.execute(text("INSERT INTO financial_profiles VALUES ('fixture',90000,252374)"))
        path = Path(__file__).resolve().parents[1] / "alembic/versions/20261003_wallet_snapshot.py"
        spec = importlib.util.spec_from_file_location("snapshot_migration", path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert "wallet_snapshot" in {c["name"] for c in inspect(connection).get_columns("financial_profiles")}
            assert connection.execute(text("SELECT current_savings FROM financial_profiles")).scalar() == 252374
            migration.downgrade()
            assert "wallet_snapshot" not in {c["name"] for c in inspect(connection).get_columns("financial_profiles")}
    engine.dispose()
