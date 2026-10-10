"""Evaluate personal monthly expense history without uploading it to a provider."""
import argparse
import json
from pathlib import Path

from app.services.forecast_service import forecast_expenses
from app.services.expense_evaluation import evaluate_holdout
from app.services.twin_state_service import parse_monthly_history


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--months", type=int, default=12)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--holdout-months", type=int, help="Run independent fixed-origin evaluation instead of a live forecast")
    parser.add_argument("--source", help="Dataset provenance, without personal identifiers")
    parser.add_argument("--currency", choices=["INR", "USD", "EUR", "GBP"])
    parser.add_argument("--data-kind", choices=["real", "synthetic"])
    parser.add_argument("--permission", help="Permission or license basis for using this dataset")
    args = parser.parse_args()
    if not 1 <= args.months <= 120:
        parser.error("--months must be between 1 and 120")
    if args.holdout_months is not None and not all([args.source, args.currency, args.data_kind, args.permission]):
        parser.error("Held-out evaluation requires --source, --currency, --data-kind and --permission")
    try:
        history = parse_monthly_history(args.csv.read_text(encoding="utf-8"))
        if args.holdout_months is not None:
            result = evaluate_holdout(history, args.holdout_months)
            result["dataset"] = {"source": args.source, "currency": args.currency,
                                 "kind": args.data_kind, "permission": args.permission}
        else:
            result = forecast_expenses(history, history[-1]["expense"], args.months)
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    text = json.dumps(result, indent=2, allow_nan=False)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
