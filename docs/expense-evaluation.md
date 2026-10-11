# Independent Expense Evaluation

This offline report evaluates the existing expense forecaster, not a new model.
It does not automatically promote models or change saved decisions.

## Dataset Audit

Use one person's consecutive completed months, in one currency, with exact CSV
headers `month,income,expense`. Do not include names, account numbers or tokens.
Record the source and permission/license basis. Confirm whether expenses exclude
internal transfers, whether refunds are netted consistently, and whether all
accounts and months are complete. Missing months must not be filled with zeros.
Do not combine unrelated people's records into one time series.

At least 16 months are needed for a three-month holdout: 12 training/validation
months, one excluded gap month, and three final test months. More history is
preferable. Source, currency, data kind and permission metadata are required by
the command but are declarations, not independent verification of data quality.

## Protocol

1. Reserve the final three months before inspecting their results.
2. Exclude the preceding month to reproduce the app's partial-current-month gap.
3. Use earlier months only for Ridge selection via the existing last-three-month
   rolling validation and fixed >5% improvement threshold.
4. Fit the selected model on the earlier history and forecast the test months
   from one fixed origin. No updating with test observations is allowed.
5. Report held-out MAE and RMSE beside the training-only trailing-three-month
   mean baseline. Metrics are in the declared currency; lower is better.

The report includes selection validation separately from final test metrics,
date boundaries, model metadata, predictions and content hashes. A model can
win validation and lose the final test. Preserve and report that result; changing
thresholds after seeing it requires a new untouched test set.

## Run

From `backend`, with permission-cleared data stored outside version control:

```bash
PYTHONPATH=. .venv/bin/python scripts/evaluate_expenses.py /path/to/monthly.csv \
  --holdout-months 3 --source "Consented personal monthly ledger" \
  --currency INR --data-kind real --permission "Owner consent for local evaluation" \
  --output /path/to/private-evaluation.json
```

Use `--data-kind synthetic` for generated demonstration data. Reports contain
monthly financial amounts: keep them private and publish only consented,
appropriately aggregated evidence. Synthetic test success is not real-world
accuracy evidence. Multiple origins and representative consenting participants
would be needed for stronger conclusions. Health/career accuracy is not evaluated.
