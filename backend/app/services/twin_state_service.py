import csv
import io
import math
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models import CareerProfile, FinancialProfile, HealthProfile, TwinState, User


def parse_monthly_history(text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    if reader.fieldnames != ["month", "income", "expense"]:
        raise ValueError("CSV columns must be exactly: month,income,expense.")
    rows = []
    for row in reader:
        if len(rows) >= 120:
            raise ValueError("Import at most 120 complete months.")
        if None in row or any(value is None for value in row.values()):
            raise ValueError("Every CSV row must contain month, income and expense.")
        try:
            period = date.fromisoformat(row["month"].strip() + "-01")
            income, expense = float(row["income"]), float(row["expense"])
        except (ValueError, TypeError):
            raise ValueError("Use YYYY-MM months and numeric income/expense values.")
        if period >= date.today().replace(day=1):
            raise ValueError("Only completed past months can be imported.")
        if not all(math.isfinite(v) and 0 <= v <= 1e12 for v in (income, expense)):
            raise ValueError("History amounts must be finite, nonnegative and at most 1 trillion.")
        rows.append({"month": period.strftime("%Y-%m"), "income": income, "expense": expense})
    if not rows:
        raise ValueError("The CSV contains no monthly observations.")
    rows.sort(key=lambda row: row["month"])
    indexes = [int(row["month"][:4]) * 12 + int(row["month"][5:]) for row in rows]
    if any(right - left != 1 for left, right in zip(indexes, indexes[1:])):
        raise ValueError("Months must be consecutive and unique; do not fill missing months with zero.")
    return rows


def current_state_data(db: Session, user_id, currency=None, history=None, history_source=None):
    """Read live profiles even when an older account has no saved TwinState."""
    user = db.get(User, user_id)
    financial = db.query(FinancialProfile).filter_by(user_id=user_id).first()
    career = db.query(CareerProfile).filter_by(user_id=user_id).first()
    health = db.query(HealthProfile).filter_by(user_id=user_id).first()
    previous = db.query(TwinState).filter_by(user_id=user_id).order_by(TwinState.created_at.desc()).first()
    bank = ((financial.wallet_snapshot or {}).get("financial_twin") or {}) if financial else {}
    if not isinstance(bank, dict):
        bank = {}
    bank_currency = bank.get("currency")
    if currency and bank_currency and currency != bank_currency:
        raise ValueError("The selected currency does not match the wallet; conversion is not supported.")
    selected_currency = bank_currency or currency or (previous.data["currency"] if previous else None)
    accounts = bank.get("accounts") or []
    if not isinstance(accounts, list):
        accounts = []
    currencies = {item["currency"] for item in accounts if isinstance(item, dict) and isinstance(item.get("currency"), str)}
    mixed_currency = bool(currencies and currencies != {selected_currency})

    def fields(profile, names):
        return {key: getattr(profile, key) for key in names} if profile else None

    data = {
        "schema_version": "1.0", "currency": selected_currency,
        "mixed_currency": mixed_currency,
        "person": fields(user, ("age", "education", "career_goal", "risk_tolerance")),
        "financial": fields(financial, ("monthly_income", "monthly_expense", "current_savings", "investments", "debts")),
        "career": fields(career, ("current_role", "years_of_experience", "expected_salary", "dream_role", "skills")),
        "health": fields(health, ("sleep_hours", "exercise_days", "height", "weight")),
        "wallet_synced_at": financial.wallet_synced_at.isoformat() if financial and financial.wallet_synced_at else None,
        "financial_source": "wallet" if bank else "manual_profile",
        "monthly_history": [], "history_source": None,
    }
    if bank and financial:
        from app.services.finance_service import financial_values
        try:
            bank_values = financial_values(financial.wallet_snapshot)
            if any(data["financial"][key] != value for key, value in bank_values.items()):
                data["financial_source"] = "manual_override_of_wallet"
        except RuntimeError:
            data["financial_source"] = "manual_profile"
    if previous and previous.data["currency"] == selected_currency:
        data["monthly_history"] = previous.data.get("monthly_history", [])
        data["history_source"] = previous.data.get("history_source")
    if history is not None:
        data["monthly_history"] = history
        data["history_source"] = {"name": history_source, "consented_at": datetime.now(timezone.utc).isoformat(), "kind": "user_monthly_csv"}
    return data


def capture_state(db: Session, user_id, source="decision", currency=None, history=None, history_source=None):
    db.flush()
    data = current_state_data(db, user_id, currency, history, history_source)
    previous = db.query(TwinState).filter_by(user_id=user_id).order_by(TwinState.created_at.desc()).first()
    if previous and previous.data == data:
        return previous
    state = TwinState(user_id=user_id, source=source, data=data)
    db.add(state)
    db.flush()
    return state
