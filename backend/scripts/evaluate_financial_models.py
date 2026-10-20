"""Train/evaluate financial models on permission-cleared monthly totals, locally."""

import argparse
import json
from pathlib import Path
from datetime import date

from app.services.finance_ml import cashflow_forecast, checked_history, fit_models
from app.services.twin_state_service import parse_monthly_history
from app.services.expense_evaluation import evaluate_holdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--source", required=True)
    parser.add_argument("--permission", required=True)
    parser.add_argument(
        "--currency", required=True, choices=["INR", "USD", "EUR", "GBP"]
    )
    parser.add_argument("--data-kind", required=True, choices=["real", "synthetic"])
    parser.add_argument(
        "--holdout-months",
        type=int,
        help="Independent fixed-origin holdout for income and expense regressions",
    )
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        rows = parse_monthly_history(args.csv.read_text(encoding="utf-8"))
        _, issue = checked_history(rows, date.today())
        if issue:
            raise ValueError(issue)
        result = {
            **fit_models(rows),
            "dataset": {
                "source": args.source,
                "permission": args.permission,
                "currency": args.currency,
                "kind": args.data_kind,
            },
            "forecasts": {
                field: cashflow_forecast(rows, rows[-1][field], field, 12, date.today())
                for field in ("income", "expense")
            },
            "note": "Risk metrics select a candidate on six validation months. They are not independent test results. Behaviour is unsupervised; no labeled accuracy is available.",
        }
        if args.holdout_months is not None:
            result["independent_holdout"] = {
                field: evaluate_holdout(
                    [{**row, "expense": row[field]} for row in rows],
                    args.holdout_months,
                )
                for field in ("income", "expense")
            }
        output = json.dumps(result, indent=2, allow_nan=False)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(output + "\n", encoding="utf-8")
        print(output)
    except (ValueError, OSError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
