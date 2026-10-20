# Financial Twin intelligence

Implemented on `feature/financial-twin-intelligence`, from main `a4f8f21`.

## Open the workspace

Sign in, open **Digital Twin**, then click **Finance** in the view navigation or
the **Financial twin** panel. Both enter the full workspace rather than highlighting
the avatar panel or opening the old finance dialog. **Back to Digital Twin** returns
to the hologram. Other Twin domains retain their existing behavior.

### Using Persona Wallet history

Wallet balances and model training history are separate. The initial finance
implementation read displayed balances/categories from Wallet, but required a
confirmed monthly import for training. A normal Wallet sync alone did not activate
the risk model, even if the Wallet account had substantial transaction history.

Connect Wallet through **Profile & Wallet**, then in Finance's **Manage training
data** section click **Review Wallet monthly history**. PersonaTwin requests
`months=24` with `end_date` fixed to the previous calendar month's final day. This
avoids the Wallet API's default six-month window and excludes the partial current
month. The response reports returned months, eligible consecutive months, excluded
no-activity months and reviewable income/expense totals. It fills the import form;
review the totals, confirm coverage/permission and click **Import & evaluate models**.
Only that confirmation saves the history. Your balances and saved scenarios are
not changed by the preview.

The Wallet may generate zero buckets for months with no recorded transactions.
Those are not silently treated as complete observations: the preview offers only
the most recent uninterrupted suffix with recorded activity. If a no-activity
month genuinely represents complete records with zero totals, enter its verified
totals manually. Recorded activity alone also does not prove full coverage; the
review/confirmation step remains necessary. The risk card now shows the eligible
month count and exact initial-training-fold class counts when it cannot train.
Twenty-four months is a minimum, not an accuracy guarantee: one-class histories
and candidates that fail chronological validation still do not publish a risk
probability. I have not inspected any private Wallet account through GitHub.

`POST /users/{id}/twin/finance/wallet-history` is an owned, read-only preview. It
forwards the connected Wallet token without storing it and returns only monthly
totals/readiness, never transactions or account identifiers. Wallet session expiry
returns a reconnect message (409), without expiring the PersonaTwin session. A
failed preview preserves the existing saved history and financial profile.

The overview shows saved income, expenses, cash, investments, debt, calculated
surplus, savings rate, recorded net assets and cash runway. Recorded net assets
means cash + investments − debt, not a complete valuation of all assets. Source,
Wallet sync time and limitations remain visible. Mixed currencies suppress combined
amounts and forecasts. Unknown currency never becomes INR automatically.

## Six modules and actual model behavior

| Module | Implementation | Data and limits |
| --- | --- | --- |
| Financial Risk Prediction | Per-user StandardScaler + LogisticRegression, regularization C=0.1 | Predicts whether expenses exceed income in the next **complete** month. This is not overall financial wellbeing, creditworthiness or default. Needs 24 recent completed months and both classes. Six chronological validation origins; candidate Brier score must beat the evolving historical-rate baseline by >5%, and validation must contain both classes. Otherwise no probability is published. |
| Expense Forecasting | Existing Ridge trend (alpha=1), evaluated against trailing-three-month mean | Requires 12 consecutive confirmed months through the previous complete month. The existing three-origin MAE gate selects Ridge only if improvement exceeds 5%; otherwise uses the mean. Without eligible history, uses saved expenses, explicitly labeled assumption. |
| Income Forecasting | Reuses the same validated forecasting implementation on the income series | Same gates and fallback behavior, evaluated independently from expenses. Predicts recorded income, not promotion, salary offers or career outcomes. |
| Debt Stress Prediction | Debt payments / current income, payments / forecast income, and a hypothetical 20% income drop | Wallet self-reported EMI schedule or a temporary user-entered monthly payment. **Not a trained default classifier**. Existing EMIs are already included in expenses; they are not subtracted again. Default/missed-payment labels are not available. |
| Financial Goal Prediction | Fresh 12-month savings trajectory from selected income/expense forecasts and current savings | Uses targets from existing saved savings-goal runs. Shows current coverage and first projected coverage month. Does not rewrite saved decisions, allocate money between overlapping goals, or publish an invented success probability. |
| Spending Behaviour Analysis | IsolationForest, 64 trees, random_state=42, contamination=auto | Fit to log-transformed monthly expenses, excluding the last completed month; score that last month as unseen data. Requires at least 12 training months + one inspection month. Negative decision score means novelty, not fraud or overspending. No labeled accuracy/probability is claimed. Wallet category bars are observed aggregates, not ML classification. |

Ridge forecast attribution comes from the intercept, time trend and clipping bound.
The risk classifier is a research estimate, not calibrated confidence. Brier score,
baseline score, balanced accuracy (only with both validation classes), and a
2×2 confusion matrix are disclosed. These are **model-selection validation**
results, not independent test accuracy. Do not cite synthetic test metrics as
PersonaTwin's real-world accuracy.

Published risk estimates also include exact standardized linear contributions to
log odds plus the intercept. Their sum passes through the logistic function to
the displayed probability. This explains the fitted model, not causal effects.

The partial current month is excluded from projections. Risk features leave a
one-month gap before each target, and validation drops the immediately preceding
training label so it cannot leak through that gap. Scalers are fitted within each
chronological training fold. Income/expense forecasts use the existing convention
that starts next month; current partial-month cash flows are not estimated.

## Training data

Use **Manage training data** in the workspace. Paste CSV with exactly:

```text
month,income,expense
```

Add actual completed-month rows (`YYYY-MM`), a source name, confirmed currency and
explicit permission/completeness confirmation. Up to 120 consecutive unique
completed months are supported. Missing months must not be filled with invented
zeros. Existing `POST /users/{id}/decisions/history` stores the source and consent
with the existing TwinState; no new database table or migration is needed.

Models are evaluated automatically from eligible history. Stale, malformed,
unconfirmed, unknown-currency or mixed-currency history never activates the models.
The per-user models are fitted on demand, with a bounded 32-entry process-memory
cache for the classifier/detector keyed by the numeric training history. There
are no persistent pickle artifacts, pooled user datasets or external AI requests.
Every report includes a model version and training-history SHA-256 fingerprint.

The Wallet contract was inspected on main. It provides balances, declared EMI,
liabilities, category spending, activity coverage and monthly cash flow. Its normal
six-month window can contain partial or unrecorded months; these are **not** silently
treated as complete training observations. Wallet aggregates stay source-labeled.
Use the existing **Profile & Wallet** flow to sync; refreshing this view reads the
latest persisted snapshot and does not make a Wallet network request.

`THUSHAR-PA/persona_models/main` was inspected: its published tree contains career
models and salary data, but no financial-risk model or NFWBS dataset. No unpublished
artifact is assumed to exist, and no untrusted pickle is downloaded/executed.
Training separate debt-default or goal-success classifiers needs genuine dated
outcomes and predictors available before those outcomes. No pseudo-labels are
invented from arbitrary financial-score thresholds.

## API, privacy and refresh

- `GET /users/{id}/twin/finance`: owned read-only aggregate and model report.
- `POST /users/{id}/twin/finance/analyze`: same report with optional bounded numeric
  `monthly_debt_payment`. This is a temporary assumption, not a profile write.
- Existing history import and saved-simulation APIs are reused.
- Authentication and ownership checks run before data retrieval or model fitting.
- Only whitelisted aggregates are returned. No bank transactions, account IDs,
  references, wallet tokens, passwords or full Wallet payload are returned.
- Initial/manual/focus/visible 30-second refresh and Wallet revision refresh reuse
  the existing single-flight hook, with timeout, abort and account-change cleanup.
  Expired auth clears the last private view. Temporary repayment scenarios reset
  when saved data is refreshed; they never persist to storage.
- React escapes labels; imported CSV stays in the existing owned backend state,
  not browser storage. Account changes/unmount abort requests and clear form data.

The workspace is lazy-loaded, with readable HTML separate from the 3D scene.
Charts include exact-value tables. Navigation, forms, validation, source labels,
keyboard focus and responsive layouts are included. The normal app still calls
the authenticated APIs. The separate demo build uses explicitly fictional values,
does not train models, and blocks imports/scenario API calls.

## Reproducible model evaluation

With the configured backend environment active, from `backend`:

```bash
PYTHONPATH=. python scripts/evaluate_financial_models.py /path/to/monthly.csv \
  --source "Reviewed bank monthly totals" --permission "Owner permission" \
  --currency INR --data-kind real --holdout-months 3 \
  --output reports/financial-models.json
```

Windows PowerShell can set `$env:PYTHONPATH="."` and run the Python command on one
line. The report evaluates all available models. The optional independent
fixed-origin holdout reuses the existing evaluation service for income and expenses:
12+ training months, one excluded gap month and 1–24 held-out months. Only earlier
training data selects the method; final held-out targets do not enter selection.
Risk remains validation-only and behaviour remains unsupervised. Store reports
locally; do not commit personal history or output reports.

Method references:
- [scikit-learn time-ordered splitting](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html)
- [scikit-learn IsolationForest](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html)

## Verification (October 20, 2026)

- Full backend suite: **103 passed**. Covers ownership, read-only scenarios,
  immutable saved decisions, no duplicate EMI subtraction, Wallet privacy/coverage,
  stale/mixed/unconfirmed data, chronological models, single-class fallback,
  actual fitting/validation and unseen-month anomaly scoring using synthetic data.
- Frontend component/geometry suite: **17 passed**. Adds finance navigation,
  module filtering and exact tables, owned scenario submission, source/consent
  import with refresh, expired session clearing and old-account response rejection.
- Production application build passed. Separate preview build checked independently.
- The training/evaluation CLI completed on an explicitly synthetic smoke dataset,
  including independent fixed-origin income and expense holdouts. These exercise
  the pipeline only; they do not establish real-data predictive performance.
- Playwright journeys updated for the finance drill-down and new history/model
  flow, read-only repayment scenarios and 320/768/1440 layouts. They require a
  browser-capable runner. New browser journeys and visual inspection remain pending
  in this environment, where earlier Chromium launch was blocked by the runtime's
  local-socket restriction. No live-user model quality or new remote CI is claimed.
- Changes are prepared on the feature branch for review; not merged or deployed.

The initial finance branch commit `cc27680` subsequently passed GitHub Actions,
including desktop/mobile browser journeys. The Wallet-history bridge follow-up
adds backend contract/privacy/coverage tests and a component test of review before
import. The follow-up passed 111 backend tests, 18 frontend component/geometry
tests, and both production builds. It has not been
tested against a real user's private Wallet records.

Run `pytest tests -q`, `npm test`, `npm run build` and, with API/Chromium available,
`npm run test:e2e -- tests/digital-twin.spec.js`. See the model data requirements
above before expecting ML estimates for a real account.
