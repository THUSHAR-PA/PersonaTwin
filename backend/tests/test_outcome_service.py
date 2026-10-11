from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services.outcome_service import summarize_outcomes


RESULT = {"currency": "INR", "trajectory": [
    {"period_end": "2024-01-31", "baseline": 100, "alternative": 200},
    {"period_end": "2024-02-29", "baseline": 200, "alternative": 400},
]}


def event(index, month=1, savings=250, branch="alternative", kind="outcome"):
    return SimpleNamespace(id=str(index), kind=kind,
                           created_at=datetime(2024, 3, 1, tzinfo=timezone.utc) + timedelta(seconds=index),
                           data={"month": month, "savings": savings, "branch": branch, "error": 999})


def test_empty_is_not_zero_error():
    result = summarize_outcomes(RESULT, [event(1, kind="feedback")])
    for branch in result["branches"].values():
        assert branch["count"] == 0
        assert branch["mae"] is None
        assert branch["rmse"] is None


def test_latest_correction_wins_even_when_events_are_unordered():
    result = summarize_outcomes(RESULT, [event(3, savings=180), event(1), event(2, month=2, savings=440)])
    branch = result["branches"]["alternative"]
    assert branch["count"] == 2
    assert branch["mae"] == 30
    assert branch["mean_error"] == 10
    assert branch["rmse"] == pytest.approx(31.62)
    assert branch["observations"][0]["event_id"] == "3"
    assert branch["observations"][0]["projected_savings"] == 200


def test_branches_do_not_mix_and_negative_balances_are_supported():
    result = summarize_outcomes(RESULT, [event(1, savings=-100), event(2, savings=100, branch="baseline")])
    assert result["branches"]["baseline"]["mae"] == 0
    assert result["branches"]["alternative"]["mean_error"] == -300
