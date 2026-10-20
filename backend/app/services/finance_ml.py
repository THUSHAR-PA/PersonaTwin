"""Small per-person models. No pooled personal data, pickle loading or invented labels."""

import hashlib
import json
import math
from datetime import date
from functools import lru_cache

from app.services.forecast_service import forecast_expenses

VERSION = "financial-intelligence-v1.1"


def checked_history(rows, today):
    if not isinstance(rows, list) or len(rows) > 120:
        return [], "History is malformed or exceeds 120 months."
    result, previous = [], None
    for row in rows:
        try:
            period = date.fromisoformat(row["month"] + "-01")
            index = period.year * 12 + period.month
            values = [row["income"], row["expense"]]
            if period >= today.replace(day=1) or any(
                isinstance(v, bool)
                or not isinstance(v, (float, int))
                or not math.isfinite(v)
                or not 0 <= v <= 1e12
                for v in values
            ):
                raise ValueError()
            if previous is not None and index != previous + 1:
                raise ValueError()
            result.append(
                {"month": row["month"], "income": values[0], "expense": values[1]}
            )
            previous = index
        except (ValueError, KeyError, TypeError):
            return (
                [],
                "History must contain consecutive completed months with finite nonnegative income and expenses.",
            )
    if result:
        last = date.fromisoformat(result[-1]["month"] + "-01")
        if today.year * 12 + today.month - (last.year * 12 + last.month) != 1:
            return (
                result,
                "History is stale. Import through the previous complete month to enable models.",
            )
    return result, None


def cashflow_forecast(history, current, field, months=12, today=None):
    mapped = [{**row, "expense": row[field]} for row in history]
    result = forecast_expenses(mapped, current, months, as_of=today)
    result["reason"] = result["reason"].replace("expense", field)
    result["series"] = field
    result["kind"] = (
        "ml_prediction"
        if result["method"] == "ridge_trend"
        else "baseline" if result["method"] == "trailing_mean" else "assumption"
    )
    evaluation = result.get("evaluation")
    if evaluation:
        errors = [row["model"] - row["actual"] for row in evaluation["observations"]]
        evaluation["model_rmse"] = math.sqrt(sum(e * e for e in errors) / len(errors))
        evaluation["note"] = (
            "Three rolling validation months select the method; these are not independent test results."
        )
    return result


def _features(rows):
    """Only observations preceding the target month; scaling is fitted per fold."""
    recent = rows[-3:]
    income = sum(row["income"] for row in recent) / 3
    expense = sum(row["expense"] for row in recent) / 3
    last = recent[-1]
    return [
        last["income"],
        last["expense"],
        income,
        expense,
        last["income"] - recent[0]["income"],
        last["expense"] - recent[0]["expense"],
    ]


def shortfall_model(history):
    result = {
        "status": "needs_data",
        "kind": "unavailable",
        "probability": None,
        "target": "Next complete month's expenses exceed income (not default or creditworthiness).",
        "required_months": 24,
        "reason": "Needs 24 recent complete months and both surplus and deficit examples.",
        "evaluation": None,
        "available_months": len(history),
    }
    if len(history) < 24:
        result["reason"] = (
            f"Only {len(history)} eligible completed months are available. This classifier requires at least 24, including surplus and deficit outcomes. Wallet summary totals alone do not train it."
        )
        return result
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import (
        brier_score_loss,
        balanced_accuracy_score,
        confusion_matrix,
    )

    # Leave the unfinished current-month gap between observed features and target.
    x = np.array([_features(history[: i - 1]) for i in range(4, len(history))])
    y = np.array([int(row["expense"] > row["income"]) for row in history[4:]])
    split = len(y) - 6
    counts = np.bincount(y[: split - 1], minlength=2)
    result["training_surplus_months"], result["training_deficit_months"] = int(
        counts[0]
    ), int(counts[1])
    if min(counts) < 3:
        result["reason"] = (
            f"The first training fold contains {counts[0]} surplus and {counts[1]} deficit outcomes. At least three of each are required; the remaining months are reserved for chronological validation and its gap."
        )
        return result

    def model():
        return make_pipeline(
            StandardScaler(), LogisticRegression(C=0.1, max_iter=300, random_state=42)
        )

    predictions, priors = [], []
    for stop in range(split, len(y)):
        estimator = model().fit(x[: stop - 1], y[: stop - 1])
        predictions.append(float(estimator.predict_proba(x[stop : stop + 1])[0, 1]))
        priors.append(float(np.mean(y[: stop - 1])))
    actual = y[split:]
    brier = float(brier_score_loss(actual, predictions))
    baseline = float(brier_score_loss(actual, priors))
    accepted = len(set(actual)) == 2 and brier < baseline * 0.95
    result["evaluation"] = {
        "protocol": "last_6_months_expanding_origin",
        "observations": 6,
        "brier": brier,
        "baseline_brier": baseline,
        "accepted": accepted,
        "confusion_matrix": confusion_matrix(
            actual, np.array(predictions) >= 0.5, labels=[0, 1]
        ).tolist(),
        "balanced_accuracy": (
            float(balanced_accuracy_score(actual, np.array(predictions) >= 0.5))
            if len(set(actual)) == 2
            else None
        ),
        "note": "Validation selects this model. Six observations do not establish calibration or independent test accuracy.",
    }
    result.update(
        status="baseline",
        kind="descriptive",
        reason="Candidate did not improve validation Brier score by >5%, or validation contains one class. No risk probability is published.",
    )
    if accepted:
        estimator = model().fit(x, y)
        scaled = estimator[0].transform([_features(history)])[0]
        coefficients = estimator[1].coef_[0]
        names = [
            "Last observed income",
            "Last observed expenses",
            "Three-month mean income",
            "Three-month mean expenses",
            "Recent income change",
            "Recent expense change",
        ]
        result.update(
            status="ready",
            kind="ml_prediction",
            probability=round(
                float(estimator.predict_proba([_features(history)])[0, 1]), 4
            ),
            reason="Logistic regression passed the disclosed validation gate; probability is an uncalibrated research estimate.",
        )
        result["explanation"] = {
            "method": "linear_log_odds_contributions_not_causal",
            "intercept": float(estimator[1].intercept_[0]),
            "factors": [
                {"feature": name, "log_odds": float(value * coefficient)}
                for name, value, coefficient in zip(names, scaled, coefficients)
            ],
        }
    result["historical_deficit_months"] = int(sum(y))
    result["labeled_months"] = len(y)
    return result


def spending_model(history):
    result = {
        "status": "needs_data",
        "kind": "unavailable",
        "required_months": 13,
        "reason": "Needs 12 training months plus one completed month to inspect.",
        "unusual": None,
    }
    if len(history) < 13:
        return result
    import numpy as np
    from sklearn.ensemble import IsolationForest

    # Fit only earlier expenses, then score the last month as an unseen observation.
    training = np.log1p([[row["expense"]] for row in history[:-1]])
    estimator = IsolationForest(
        n_estimators=64, contamination="auto", random_state=42, n_jobs=1
    ).fit(training)
    score = float(estimator.decision_function(np.log1p([[history[-1]["expense"]]]))[0])
    mean = sum(row["expense"] for row in history[-4:-1]) / 3
    return {
        "status": "ready",
        "kind": "unsupervised",
        "method": "isolation_forest",
        "training_months": len(training),
        "month": history[-1]["month"],
        "expense": history[-1]["expense"],
        "unusual": score < 0,
        "score": round(score, 4),
        "versus_previous_three_pct": (
            round((history[-1]["expense"] / mean - 1) * 100, 1) if mean else None
        ),
        "reason": "Unsupervised monthly spending novelty; negative score means unusual versus earlier months. It is not fraud, overspending or an anomaly probability. No labeled accuracy is available.",
    }


@lru_cache(maxsize=32)
def _fit(history_json):
    history = json.loads(history_json)
    try:
        return {"risk": shortfall_model(history), "behaviour": spending_model(history)}
    except ImportError:
        return {
            key: {
                "status": "unavailable",
                "kind": "unavailable",
                "reason": "Install the backend's NumPy and scikit-learn dependencies to train this model.",
            }
            for key in ("risk", "behaviour")
        }


def fit_models(history):
    # Bounded process memory only. Contains no account identifiers or tokens.
    payload = json.dumps(history, sort_keys=True, separators=(",", ":"))
    return {
        **_fit(payload),
        "data_hash": hashlib.sha256(payload.encode()).hexdigest(),
        "version": VERSION,
    }
