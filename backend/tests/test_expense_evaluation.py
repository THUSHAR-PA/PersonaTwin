from copy import deepcopy

import pytest

from app.services.expense_evaluation import evaluate_holdout


def history():
    return [{"month": f"{2023 + i // 12}-{i % 12 + 1:02d}",
             "income": 50000, "expense": 10000 + i * 200} for i in range(18)]


def test_holdout_matches_decision_calendar_and_has_finite_metrics():
    report = evaluate_holdout(history())
    assert report["training_period"] == ["2023-01", "2024-02"]
    assert report["gap_month"] == "2024-03"
    assert report["test_period"] == ["2024-04", "2024-06"]
    assert report["selected_method"] == "ridge_trend"
    assert report["artifact"]["forecast_start_index"] == 15
    assert report["test_metrics"]["selected"]["mae"] < report["test_metrics"]["baseline"]["mae"]


def test_gap_and_test_values_cannot_influence_selection_or_predictions():
    original = history()
    changed = deepcopy(original)
    for row in changed[-4:]:
        row["expense"] = 900000
    before, after = evaluate_holdout(original), evaluate_holdout(changed)
    for key in ("selected_method", "artifact", "selection_validation", "training_hash"):
        assert before[key] == after[key]
    assert [r["selected_prediction"] for r in before["observations"]] == [r["selected_prediction"] for r in after["observations"]]
    assert before["test_metrics"] != after["test_metrics"]
    assert before["dataset_hash"] != after["dataset_hash"]


def test_constant_zero_history_uses_baseline_without_percentage_errors():
    rows = history()
    for row in rows:
        row["expense"] = 0
    report = evaluate_holdout(rows)
    assert report["selected_method"] == "trailing_mean"
    assert report["test_metrics"]["selected"] == {"mae": 0, "rmse": 0}


@pytest.mark.parametrize("months", [0, 6, 25])
def test_rejects_invalid_split(months):
    with pytest.raises(ValueError):
        evaluate_holdout(history(), months)
