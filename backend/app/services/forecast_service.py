import hashlib
import json
from datetime import date


def forecast_expenses(history, current_expense, months, mode="auto", *, as_of=None):
    result = {
        "method": "profile_assumption", "version": "expense-trend-v1",
        "values": [current_expense] * months, "evaluation": None,
        "attribution": [], "artifact": None,
        "history_months": len(history),
        "data_hash": hashlib.sha256(json.dumps(history, sort_keys=True).encode()).hexdigest(),
        "reason": "Using the saved monthly expense assumption.",
    }
    if mode == "profile":
        return result
    if len(history) < 12:
        result["reason"] = "At least 12 consecutive complete months are needed to evaluate a trained expense model. Using the profile assumption."
        return result
    last = date.fromisoformat(history[-1]["month"] + "-01")
    today = as_of or date.today()
    age = (today.year - last.year) * 12 + today.month - last.month
    if age != 1:
        result["reason"] = "History must end in the previous complete month. Using the profile assumption because history is stale."
        return result
    try:
        import numpy as np
        import sklearn
        from sklearn.linear_model import Ridge
    except ImportError:
        result["reason"] = "Forecasting dependencies are unavailable. Using the profile assumption."
        return result

    values = np.array([row["expense"] for row in history], dtype=float)
    indexes = np.arange(len(values), dtype=float).reshape(-1, 1)
    # Rolling origins only use earlier observations; the last three are evaluation targets.
    predicted, baseline, actual = [], [], []
    for stop in range(len(values) - 3, len(values)):
        model = Ridge(alpha=1.0).fit(indexes[:stop], values[:stop])
        predicted.append(max(0.0, float(model.predict(indexes[stop:stop + 1])[0])))
        baseline.append(float(np.mean(values[stop - 3:stop])))
        actual.append(float(values[stop]))
    model_mae = float(np.mean(np.abs(np.array(predicted) - actual)))
    baseline_mae = float(np.mean(np.abs(np.array(baseline) - actual)))
    use_model = model_mae < baseline_mae * 0.95
    result["evaluation"] = {
        "protocol": "last_3_months_rolling_origin", "model_mae": model_mae,
        "baseline_mae": baseline_mae, "threshold": "MAE must improve by more than 5%",
        "accepted": use_model,
        "observations": [{"month": history[-3 + i]["month"], "actual": actual[i], "model": predicted[i], "baseline": baseline[i]} for i in range(3)],
    }
    if use_model:
        model = Ridge(alpha=1.0).fit(indexes, values)
        intercept, slope = float(model.intercept_), float(model.coef_[0])
        # History ends last month; decisions begin next month, excluding the partial current month.
        start_index = len(values) + 1
        raw = model.predict(np.arange(start_index, start_index + months).reshape(-1, 1))
        upper = max(float(max(values)) * 3, current_expense * 3, 1)
        result.update({
            "method": "ridge_trend", "values": np.clip(raw, 0, upper).tolist(),
            "reason": "Ridge trend improved rolling validation MAE by more than 5%; refitted on all available history.",
            "artifact": {"intercept": intercept, "slope": slope, "training_months": len(values), "forecast_start_index": start_index, "alpha": 1.0, "sklearn_version": sklearn.__version__, "clip_range": [0, upper]},
            "attribution": [
                {"feature": "Intercept", "contribution": intercept},
                {"feature": "Monthly time trend", "contribution": slope * start_index},
                {"feature": "Nonnegative/extrapolation bound", "contribution": float(np.clip(raw[0], 0, upper) - raw[0])},
            ],
        })
    else:
        mean = float(np.mean(values[-3:]))
        result.update({"method": "trailing_mean", "values": [mean] * months,
                       "reason": "The trained candidate did not beat the baseline by 5%; using the last three months' mean.",
                       "attribution": [{"feature": "Last three months' mean", "contribution": mean}]})
    return result
