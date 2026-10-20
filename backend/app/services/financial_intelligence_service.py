"""Whitelisted financial workspace. Reads existing data; never modifies saved simulations."""

from datetime import date, datetime, timezone
import math

from app.models import FinancialProfile
from app.services.finance_ml import (
    cashflow_forecast,
    checked_history,
    fit_models,
    VERSION,
)
from app.services.twin_dashboard_service import get_dashboard
from app.services.twin_state_service import current_state_data
from app.services.decision_service import month_end


def finite(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) and abs(number) <= 1e12 else None
    except (TypeError, ValueError):
        return None


def analyze(state, dashboard, wallet, today=None, debt_payment=None):
    today = today or date.today()
    profile = state.get("financial") or {}
    mixed = bool(state.get("mixed_currency"))
    currency = state.get("currency")
    supported = currency in ("INR", "USD", "EUR", "GBP") and not mixed
    rows, history_issue = checked_history(state.get("monthly_history", []), today)
    eligible = bool(
        rows
        and supported
        and not history_issue
        and (state.get("history_source") or {}).get("kind") == "user_monthly_csv"
    )
    training = rows if eligible else []
    income, expense, cash, investments, debt = [
        finite(profile.get(key))
        for key in (
            "monthly_income",
            "monthly_expense",
            "current_savings",
            "investments",
            "debts",
        )
    ]
    values_known = all(v is not None and v >= 0 for v in (income, expense, cash))
    wallet = wallet if isinstance(wallet, dict) else {}
    wallet_matches = supported and wallet.get("currency") == currency
    metrics = wallet.get("metrics") if isinstance(wallet.get("metrics"), dict) else {}
    loan_payment = (
        finite(metrics.get("declared_monthly_emi")) if wallet_matches else None
    )
    payment_source = (
        "Wallet self-reported repayment schedule"
        if loan_payment is not None
        else "No repayment schedule available; enter a temporary monthly payment"
    )
    if debt_payment is not None:
        loan_payment, payment_source = (
            debt_payment,
            "User-entered scenario assumption; not saved to your profile",
        )
    if loan_payment is None and debt == 0:
        loan_payment, payment_source = 0, "No debt recorded in the saved profile"

    forecasts = {}
    if supported and values_known:
        forecasts = {
            field: cashflow_forecast(training, value, field, 12, today)
            for field, value in (("income", income), ("expense", expense))
        }
    trained = fit_models(training)
    timeline, balance = [], cash
    for index in range(12 if forecasts else 0):
        incoming, outgoing = (
            forecasts["income"]["values"][index],
            forecasts["expense"]["values"][index],
        )
        balance += incoming - outgoing
        timeline.append(
            {
                "month": month_end(today, index + 1).strftime("%Y-%m"),
                "income": round(incoming, 2),
                "expense": round(outgoing, 2),
                "savings": round(balance, 2),
            }
        )

    goals = []
    for goal in dashboard.get("goals", {}).get("financial", []):
        target = finite(goal.get("target_amount"))
        compatible = bool(
            timeline
            and goal.get("currency") == currency
            and target is not None
            and target > 0
        )
        reached = (
            "Already covered by current savings"
            if compatible and cash >= target
            else (
                next(
                    (row["month"] for row in timeline if row["savings"] >= target), None
                )
                if compatible
                else None
            )
        )
        goals.append(
            {
                "id": goal["id"],
                "title": goal.get("title"),
                "target": target,
                "currency": goal.get("currency"),
                "progress_pct": (
                    round(min(100, cash / target * 100), 1) if compatible else None
                ),
                "achievement_month": reached,
                "projected_savings_12m": (
                    timeline[-1]["savings"] if compatible else None
                ),
                "status": "projection" if compatible else "unavailable",
                "original_deadline": goal.get("period_end"),
            }
        )

    debt_result = {
        "kind": "conditional_projection",
        "monthly_payment": loan_payment,
        "source": payment_source,
        "payment_to_income_pct": (
            round(loan_payment / income * 100, 1)
            if supported and loan_payment is not None and income and income > 0
            else None
        ),
        "stressed_payment_to_income_pct": (
            round(loan_payment / (income * 0.8) * 100, 1)
            if supported and loan_payment is not None and income and income > 0
            else None
        ),
        "reason": "Repayment burden under unchanged income and a hypothetical 20% income drop. Not a trained default model. EMI is already part of expenses; never subtracted twice.",
        "status": (
            "ready"
            if supported and loan_payment is not None and values_known
            else "needs_data"
        ),
    }
    if timeline and loan_payment is not None:
        debt_result["forecast_payment_to_income_pct"] = (
            round(loan_payment / timeline[0]["income"] * 100, 1)
            if timeline[0]["income"] > 0
            else None
        )
    categories = []
    if wallet_matches:
        for row in (wallet.get("category_spend") or [])[:40]:
            value = finite(row.get("amount")) if isinstance(row, dict) else None
            if (
                value is not None
                and value >= 0
                and isinstance(row.get("category"), str)
            ):
                categories.append({"category": row["category"][:80], "amount": value})
    categories.sort(key=lambda row: row["amount"], reverse=True)
    period = wallet.get("period") if isinstance(wallet.get("period"), dict) else {}
    quality = (
        wallet.get("data_quality")
        if isinstance(wallet.get("data_quality"), dict)
        else {}
    )
    warnings = [
        "Research prototype. Forecasts are assumptions or small personal-history models, not validated financial advice.",
        "Projections begin next month, exclude investment returns, inflation and tax changes, and assume recorded expenses include existing debt repayments.",
        "Goal projections share the same savings; funds are not allocated and overlapping goals cannot all claim that balance.",
    ]
    if not supported:
        warnings.append(
            "Confirm a single supported currency before forecasting. No conversion or combined mixed-currency analysis is performed."
        )
    if history_issue:
        warnings.append(history_issue)
    if wallet:
        warnings.append(
            "Wallet averages may include partial months or months without recorded activity. Wallet history is not automatically treated as complete training data."
        )
    synced = state.get("wallet_synced_at")
    if synced:
        try:
            timestamp = datetime.fromisoformat(synced)
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            age = datetime.now(timezone.utc) - timestamp
            if age.total_seconds() > 86400:
                warnings.append(
                    "Wallet snapshot is more than 24 hours old. Sync Wallet from Profiles to update it."
                )
        except (ValueError, TypeError):
            warnings.append("Wallet sync time is unavailable.")
    return {
        "schema_version": "1.0",
        "as_of": today.isoformat(),
        "currency": currency,
        "mixed_currency": mixed,
        "summary": {
            "profile_present": bool(profile),
            "income": income,
            "expense": expense,
            "cash": cash,
            "investments": investments,
            "debt": debt,
            "monthly_surplus": (
                round(income - expense, 2)
                if supported and income is not None and expense is not None
                else None
            ),
            "recorded_net_assets": (
                round(cash + investments - debt, 2)
                if supported and all(v is not None for v in (cash, investments, debt))
                else None
            ),
            "cash_runway_months": (
                round(cash / expense, 1)
                if supported and cash is not None and expense and expense > 0
                else None
            ),
            "savings_rate": (
                round((income - expense) / income * 100, 1)
                if supported and income and income > 0 and expense is not None
                else None
            ),
            "source": state.get("financial_source"),
            "wallet_synced_at": synced,
        },
        "history": {
            "months": len(rows),
            "eligible": eligible,
            "issue": history_issue,
            "source": (state.get("history_source") or {}).get("name"),
            "last_month": rows[-1]["month"] if rows else None,
        },
        "models": {"version": VERSION, "data_hash": trained["data_hash"]},
        "risk": trained["risk"],
        "forecasts": forecasts,
        "timeline": timeline,
        "debt_stress": debt_result,
        "goals": goals,
        "behaviour": trained["behaviour"],
        "categories": categories,
        "wallet_period": {key: period.get(key) for key in ("start", "end", "months")},
        "wallet_quality": {
            "missing_months": quality.get("missing_months", []),
            "months_with_activity": finite(metrics.get("months_with_activity")),
        },
        "warnings": warnings,
    }


def get_financial_intelligence(db, user_id, debt_payment=None):
    state = current_state_data(db, user_id)
    dashboard = get_dashboard(db, user_id)
    profile = db.query(FinancialProfile).filter_by(user_id=user_id).first()
    wallet = (
        (profile.wallet_snapshot or {}).get("financial_twin", {}) if profile else {}
    )
    return analyze(state, dashboard, wallet, debt_payment=debt_payment)
