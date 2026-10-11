import calendar
import math
from datetime import date, datetime, timezone

from app.schemas.decision import DecisionRequest
from app.services.forecast_service import forecast_expenses


def month_end(start: date, offset: int) -> date:
    index = start.year * 12 + start.month - 1 + offset
    year, month = index // 12, index % 12 + 1
    return date(year, month, calendar.monthrange(year, month)[1])


def evaluate_decision(state: dict, request: DecisionRequest, as_of: date | None = None) -> dict:
    as_of = as_of or date.today()
    profile = state.get("financial")
    if state.get("mixed_currency"):
        raise ValueError("Mixed-currency wallet accounts cannot be projected together; conversion is not supported.")
    if not profile or state.get("currency") not in ("INR", "USD", "EUR", "GBP"):
        raise ValueError("Save a financial profile and confirm its currency before creating a decision.")
    income, expense, cash = (profile.get(key) for key in ("monthly_income", "monthly_expense", "current_savings"))
    if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and 0 <= v <= 1e12 for v in (income, expense, cash)):
        raise ValueError("Income, expenses and liquid savings must be known, finite and nonnegative.")
    n = request.months
    forecast = forecast_expenses(state.get("monthly_history", []), expense, n, request.forecast)
    expenses = forecast["values"]
    if request.monthly_reduction > min(expenses):
        raise ValueError("The monthly reduction cannot exceed any projected month's expenses.")
    career = request.scenario in ("job_switch", "higher_studies")
    lifestyle = request.scenario == "lifestyle"
    baseline_income = [income] * n
    alternative_income = ([0 if i < request.gap_months else request.target_monthly_income for i in range(n)] if career else baseline_income)
    alternative_expense = [e - request.monthly_reduction + (request.monthly_lifestyle_cost if lifestyle else 0) for e in expenses]
    upfront = request.transition_cost if career else 0

    def project(incomes, costs, initial):
        values, balance = [], initial
        for incoming, outgoing in zip(incomes, costs):
            balance += incoming - outgoing
            values.append(balance)
        return values

    baseline = project(baseline_income, expenses, cash)
    alternative = project(alternative_income, alternative_expense, cash - upfront)
    uncertainty = None
    if request.uncertainty_pct:
        try:
            import numpy as np
        except ImportError:
            raise RuntimeError("Uncertainty simulation requires NumPy. Install backend dependencies or set uncertainty to zero.")
        rng = np.random.default_rng(request.seed)
        # Shared expense shocks isolate the change in strategy between paired paths.
        sigma = request.uncertainty_pct / 100
        shocks = rng.lognormal(-sigma * sigma / 2, sigma, size=(request.samples, n))
        simulated_expenses = np.array(expenses) * shocks
        base_paths = cash + np.cumsum(np.array(baseline_income) - simulated_expenses, axis=1)
        alt_costs = np.maximum(0, simulated_expenses - request.monthly_reduction) + (request.monthly_lifestyle_cost if lifestyle else 0)
        alt_paths = cash - upfront + np.cumsum(np.array(alternative_income) - alt_costs, axis=1)
        uncertainty = {
            "method": "independent_monthly_lognormal_expense_shocks", "seed": request.seed,
            "samples": request.samples, "expense_sigma_pct": request.uncertainty_pct,
            "numpy_version": np.__version__,
            "baseline": {"p10": np.percentile(base_paths, 10, axis=0).tolist(), "p50": np.percentile(base_paths, 50, axis=0).tolist(), "p90": np.percentile(base_paths, 90, axis=0).tolist(), "goal_probability": float(np.mean(base_paths[:, -1] >= request.target_amount))},
            "alternative": {"p10": np.percentile(alt_paths, 10, axis=0).tolist(), "p50": np.percentile(alt_paths, 50, axis=0).tolist(), "p90": np.percentile(alt_paths, 90, axis=0).tolist(), "goal_probability": float(np.mean(alt_paths[:, -1] >= request.target_amount))},
        }

    reduction_needed = max(0, (request.target_amount - baseline[-1]) / n)
    feasible = math.ceil(reduction_needed * 100) / 100 <= min(expenses)
    counterfactual = {
        "scope": "baseline_expense_reduction_only", "feasible": feasible,
        "monthly_reduction": round(math.ceil(reduction_needed * 100) / 100, 2) if feasible else None,
        "result": None,
        "reason": "No uniform nonnegative expense reduction can meet this target." if not feasible else "Calculated for the deterministic baseline, without changing income.",
    }
    if feasible:
        checked = project(baseline_income, [e - counterfactual["monthly_reduction"] for e in expenses], cash)[-1]
        counterfactual["result"] = round(checked, 2)
        counterfactual["verified"] = checked + 0.005 >= request.target_amount

    contributions = [
        {"factor": "Spending reduction", "amount": request.monthly_reduction * n},
        {"factor": "Income change", "amount": sum(alternative_income) - sum(baseline_income)},
        {"factor": "Transition cost", "amount": -upfront},
        {"factor": "Lifestyle budget", "amount": -request.monthly_lifestyle_cost * n if lifestyle else 0},
    ]
    warnings = [
        "Starting cash is held unchanged until next month; remaining partial-month cash flows are excluded.",
        "Cash-flow projection excludes investment returns, inflation and taxes; income means take-home income.",
        "Existing debt payments must already be included in monthly expenses. Investments are not liquid savings.",
        "Model validation uses only three rolling observations; this is a research prototype, not a validated population forecast.",
    ]
    synced = state.get("wallet_synced_at")
    if synced:
        timestamp = datetime.fromisoformat(synced)
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - timestamp).total_seconds() > 86400:
            warnings.append("Wallet data is over 24 hours old; refresh it before relying on this projection.")
    else:
        warnings.append("This state has no wallet sync timestamp; amounts are user-supplied.")
    if uncertainty:
        warnings.append("Probabilities are conditional on the selected expense variation, not calibrated confidence. Income and employment are fixed assumptions.")
    if lifestyle:
        warnings.append("Activity hours are a plan, not a medical prediction. Health benefits are not estimated.")
    recommendations = []
    if alternative[-1] >= request.target_amount:
        recommendations.append({"action": "Review the alternative against your commitments.", "reason": f"It exceeds the target by {alternative[-1] - request.target_amount:,.2f} under the saved assumptions."})
    else:
        recommendations.append({"action": "Adjust the target, horizon or proposed spending change.", "reason": f"The alternative remains {request.target_amount - alternative[-1]:,.2f} below the target."})
    if min([cash - upfront] + alternative) < 0:
        recommendations.append({"action": "Resolve the projected cash deficit before committing.", "reason": "At least one projected balance is negative; no borrowing facility is assumed."})
    if feasible and reduction_needed:
        recommendations.append({"action": f"Evaluate a monthly reduction of {counterfactual['monthly_reduction']:,.2f}.", "reason": "Recalculation reaches the target from the baseline; feasibility against essential expenses still needs your review."})

    return {
        "engine_version": "cash-flow-v1", "as_of": as_of.isoformat(), "currency": state["currency"],
        "period_convention": "full_calendar_months_starting_next_month", "target_amount": request.target_amount,
        "baseline": {"final_savings": round(baseline[-1], 2), "goal_met": baseline[-1] >= request.target_amount},
        "alternative": {"final_savings": round(alternative[-1], 2), "goal_met": alternative[-1] >= request.target_amount},
        "difference": round(alternative[-1] - baseline[-1], 2),
        "trajectory": [{"month": i + 1, "period_end": month_end(as_of, i + 1).isoformat(), "baseline": round(baseline[i], 2), "alternative": round(alternative[i], 2), "expense_forecast": round(expenses[i], 2)} for i in range(n)],
        "effective_inputs": {"initial_cash": cash, "monthly_income": income, "monthly_expense": expense, "currency": state["currency"]},
        "forecast": forecast, "uncertainty": uncertainty, "contributions": contributions,
        "counterfactual": counterfactual, "recommendations": recommendations, "warnings": warnings,
        "lifestyle": {"weekly_activity_hours": request.weekly_activity_hours, "monthly_cost": request.monthly_lifestyle_cost} if lifestyle else None,
    }
