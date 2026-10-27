# Decision Engine

## Implemented Flow

The React Simulations workspace calls owned FastAPI endpoints under
`/users/{user_id}/decisions`. Profile updates capture immutable twin states.
Decisions preserve the selected state, request, model artifact, version, seed and
result. Feedback and outcomes are separate events; later syncs do not rewrite runs.

Supported integrated scenarios: savings goals, job switches, higher studies and
lifestyle budgets. Career and education scenarios use current personal income,
an explicit income gap, transition cost and proposed new monthly take-home income.
Lifestyle decisions quantify budget and planned activity hours, not medical effects.
The existing eight standalone calculators remain available under Simulations → Calculators.

## Data and Time

- Supported decision currencies: INR, USD, EUR and GBP. No exchange-rate conversion.
- Wallet/profile values feed the financial state; mixed-currency wallet totals cannot be projected.
- Current cash is held unchanged until next month; projections cover full calendar months from then onward. Partial current-month activity is excluded explicitly.
- Salary is monthly take-home income. Expenses must already include existing debt payments. Investments are not treated as liquid cash.
- Monthly history is explicitly imported as UTF-8 CSV: `month,income,expense`. Use consecutive completed months in YYYY-MM form, with transfers excluded and known zeros distinguished from missing periods.
- Import is bounded to 120 months/100 KB, requires source attribution and permission confirmation, and remains local to this backend.
- Raw wallet transaction categories are not automatically inferred into training data. The current bank summary contract does not establish enough category/coverage semantics for reliable reconstruction.
- Wallet snapshots older than 24 hours are flagged. Trained forecasts require history ending in the previous completed month.

## Forecast Model Card

Target: monthly personal spending in the state's currency. Predictor: month index.
Candidate: scikit-learn Ridge regression, alpha 1.0, fit per decision to the user's
history. At least 12 consecutive months are required. The last three observations
are predicted with rolling origins using only earlier observations. Compare MAE to
the preceding three-month mean at each origin. Promote the candidate only if its
MAE is more than 5% lower; otherwise use the trailing mean. After selection, refit
on all available history. This validation selects a model; it is not an independent
final test set for a generalization claim.

The serialized coefficient, intercept, library version, data hash and extrapolation
bounds are included in the saved result. Predictions are clipped between zero and
three times the larger of historical maximum/current spending (minimum upper bound
one currency unit). The attribution decomposes the next projected month's value
into intercept, time contribution and clipping correction. These contributions sum
to the displayed prediction; they are not causal effects or SHAP values.

Limitations: short personal histories, trend-only model, no seasonality or population
calibration, no job-market or medical prediction. Synthetic test fixtures demonstrate
implementation correctness only. Real-data evaluation and a separate held-out test
period are required for the academic report.

## Simulation and Explanation

Cash evolves as previous cash + income - expense. Alternative scenarios modify
income, spending and one-time costs. A deterministic contribution table reconciles
exactly to the difference between final balances. A uniform spending-reduction
counterfactual is calculated and rerun through the cash-flow equation. Mathematical
feasibility does not establish affordability of essential expenses.

Optional NumPy Monte Carlo uses shared, independent monthly lognormal expense shocks
with mean one. The selected percentage is log-space sigma. Income/employment stay
fixed; no probabilities are learned from data. Display 10th/50th/90th percentiles and
conditional final-target attainment. Save seed, number of paths and NumPy version.
Zero uncertainty selects the deterministic path. Requests are bounded to 120 months
and 5,000 paths. This is assumption sensitivity, not a calibrated risk estimate.

Observed cash outcomes must match a completed projection month-end and the selected
baseline/alternative. Feedback does not automatically retrain or promote a model.
Deletion removes a decision and its events; account deletion also removes states.

## Verification

From `backend`:

```bash
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/alembic upgrade head
PYTHONPATH=. .venv/bin/pytest tests -q
PYTHONPATH=. .venv/bin/python scripts/evaluate_expenses.py /path/to/monthly.csv --months 12
.venv/bin/python scripts/smoke_decisions.py
```

The smoke command requires the running backend, creates a clearly named disposable
synthetic account, checks deterministic and trained/stochastic flows, then deletes
the account. It does not read existing users' data.

From `frontend`, with the backend running:

```bash
npm run build
npm install -D @playwright/test
npx playwright install chromium
npx playwright test
```

By default, Playwright starts its own Vite server at `http://127.0.0.1:5174`.
Port 5174 must be free. The setup checks backend health and frontend HTML before
creating test accounts. To clear previously exported external-server settings:

```bash
env -u E2E_EXTERNAL_SERVER -u E2E_BASE_URL npx playwright test
```

For an already-running frontend:

```bash
E2E_EXTERNAL_SERVER=1 E2E_BASE_URL=http://localhost:5173 npx playwright test
```

Browser tests create disposable accounts, verify desktop/mobile comparison and
history, check canvas pixels and horizontal overflow, and capture screenshots.
Browser tooling installation may require local network access.

Library references: [scikit-learn Ridge](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html)
and [NumPy Generator](https://numpy.org/doc/stable/reference/random/generator.html).
# Observed Savings Evaluation

Detailed decision responses now include `outcome_evaluation`. For each strategy
(`baseline`, `alternative`) it returns observation count, MAE, RMSE, mean signed
error and monthly comparisons. Errors are observed savings minus the immutable
saved savings projection, in the decision's currency. No observations produces
null metrics, not a misleading zero error.

The latest recorded outcome per strategy/month is used for metrics; all earlier
events remain in the audit history. Timestamp ties use event ID for deterministic
ordering. A correction does not overwrite the original decision or its projection.
Ownership checks apply to the enclosing decision response. The existing JSON
export includes this summary. The Simulations workspace displays strategy metrics and
monthly comparisons. Outcome entry lists only completed periods, accepts notes
and negative balances, and identifies corrections while retaining earlier events.
New decisions show an empty state until a projection month is completed.

These are self-reported savings deviations, not isolated expense-forecast errors
or causal evidence. No automatic retraining or promotion follows from them.


### Four-case comparison

New saved runs and completed chat comparisons include current, worst, best and
alternative cases with assumptions, monthly cash, final savings and minimum cash.
Current keeps the saved plan. Alternative applies the entered change (chat: cash
purchase, requested spending cut, or stated job switch). Worst/best rerun that
alternative with forecast expenses 20% higher/lower, before spending cuts; cuts
are capped at available expenses. Saved runs expose case_expense_variation_pct
(0–50, default 20); chat uses a disclosed fixed 20%. Income and other costs stay
fixed. These are expense sensitivity cases, not global bounds or probabilities.
Recommendation ranking and outcome tracking retain their existing semantics.
Older saved runs retain their original results; rerun to get four cases.
Standalone calculators remain single-input calculators.
