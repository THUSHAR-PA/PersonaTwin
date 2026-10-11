"""Compare user-reported observations with immutable saved savings projections."""
import math


def summarize_outcomes(result, events):
    latest = {}
    ordered = sorted(events, key=lambda event: (event.created_at, str(event.id)))
    for event in ordered:
        if event.kind == "outcome":
            latest[(event.data["branch"], event.data["month"])] = event
    branches = {}
    for branch in ("baseline", "alternative"):
        observations = []
        for (name, month), event in sorted(latest.items()):
            if name != branch:
                continue
            point = result["trajectory"][month - 1]
            actual = event.data["savings"]
            predicted = point[branch]
            observations.append({
                "month": month, "period_end": point["period_end"],
                "event_id": str(event.id), "actual_savings": actual,
                "projected_savings": predicted, "error": round(actual - predicted, 2),
            })
        errors = [row["error"] for row in observations]
        count = len(errors)
        branches[branch] = {
            "count": count,
            "mae": round(sum(abs(e) for e in errors) / count, 2) if count else None,
            "rmse": round(math.sqrt(sum(e * e for e in errors) / count), 2) if count else None,
            "mean_error": round(sum(errors) / count, 2) if count else None,
            "observations": observations,
        }
    return {
        "version": "observed-savings-v1", "currency": result["currency"],
        "correction_policy": "Latest recorded event per branch and month; earlier events retained.",
        "error_definition": "Observed savings minus saved projected savings.",
        "branches": branches,
        "limitations": [
            "User-reported savings are not independently verified.",
            "Savings deviations include changes in income, expenses and behavior, not only forecast error.",
            "These observations do not establish causal effects or automatically retrain models.",
        ],
    }
