"""Offline fixed-origin evaluation; final targets never enter model selection."""
import hashlib
import json
import math
from datetime import date

from app.services.forecast_service import forecast_expenses


def evaluate_holdout(history, test_months=3):
    # One month represents the partial current month omitted by live decisions.
    if not 1 <= test_months <= 24 or len(history) < 12 + 1 + test_months:
        raise ValueError("Require 12 training months, one gap month and 1-24 test months.")
    training = history[:-(test_months + 1)]
    gap = history[-(test_months + 1)]
    targets = history[-test_months:]
    forecast = forecast_expenses(
        training, training[-1]["expense"], test_months,
        as_of=date.fromisoformat(gap["month"] + "-01"),
    )
    if forecast["evaluation"] is None:
        raise ValueError("Model evaluation unavailable; check history and forecasting dependencies.")
    baseline = sum(row["expense"] for row in training[-3:]) / 3
    observations = [
        {"month": row["month"], "actual": row["expense"],
         "selected_prediction": prediction, "baseline_prediction": baseline}
        for row, prediction in zip(targets, forecast["values"])
    ]

    def metrics(key):
        errors = [row[key] - row["actual"] for row in observations]
        return {"mae": sum(abs(e) for e in errors) / len(errors),
                "rmse": math.sqrt(sum(e * e for e in errors) / len(errors))}

    return {
        "protocol": "fixed_origin_gap_one_month_v1",
        "training_period": [training[0]["month"], training[-1]["month"]],
        "gap_month": gap["month"],
        "test_period": [targets[0]["month"], targets[-1]["month"]],
        "selection_rule": "Training-only last-three-month rolling validation; >5% MAE improvement.",
        "selected_method": forecast["method"],
        "selection_validation": forecast["evaluation"],
        "artifact": forecast["artifact"],
        "forecast_version": forecast["version"],
        "dataset_hash": hashlib.sha256(json.dumps(history, sort_keys=True).encode()).hexdigest(),
        "training_hash": forecast["data_hash"],
        "test_metrics": {"selected": metrics("selected_prediction"), "baseline": metrics("baseline_prediction")},
        "observations": observations,
        "limitations": ["Single-series, single-origin evaluation is not population-level evidence.",
                        "Do not tune selection rules after inspecting test results.",
                        "Gap-month expenses are excluded, matching the application's partial-month exclusion."],
    }
