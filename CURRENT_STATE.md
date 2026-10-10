# PersonaTwin — Current State

Updated October 10, 2026 from the working tree, source code and existing progress log.
This document replaces the outdated July 19 scaffold inventory. It includes work
already present in the repository and the chat implementation;
it does not attribute all existing code to this documentation session.

## Status

The `feature/chat-decision-assistant` branch adds a chat-first prototype
on top of `8c611b6`. It includes owned saved conversations, local Ollama structured
intent extraction, live profile loading without requiring an old snapshot,
purchase/loan/savings/job-change comparisons, quoted inputs, auditable selection
rules and rerun counterfactuals. Persona Models integration remains deferred.
See [chat-demo.md](docs/chat-demo.md) for setup, demo inputs and limits. The earlier
sections below describe the inherited decision workspace; Chat is now the default.
This branch contains the prototype source; deployment remains unverified.

PersonaTwin has a React/Vite frontend, FastAPI backend, SQLAlchemy/PostgreSQL
persistence and Alembic migrations. The implemented prototype supports profiles,
wallet/GitHub sync, saved financial scenario comparisons, expense forecasting,
explanations, feedback and observed outcomes. The broader research proposal is
still in progress; production deployment and real-data model quality are not verified.

## Completed implementation

### Accounts, profiles and integrations

- Registration/login and bearer authentication, financial/career/health profile
  management, overview and digital twin aggregation are present.
- User, career and health routes now enforce authentication and ownership.
  Listing users returns only the authenticated account. Missing bearer credentials
  return HTTP 401 with a Bearer authentication challenge.
- Financial profile amounts reject negative, nonfinite and excessive values;
  updates reject explicit null amounts. Formula calculator inputs also reject
  nonfinite values and magnitudes above one trillion.
- Persona Wallet sync mirrors the bank ledger, retaining the full snapshot and
  last successful sync time. Failed or malformed refreshes preserve previous data.
  Missing wallet database columns produce migration guidance.
- Connected wallet refresh uses active-tab polling/focus and simulation refresh.
  GitHub sync populates career information. These integrations existed before the
  latest decision-engine additions; see the bank integration guide for details.
- Twin score wording identifies descriptive heuristics. The placeholder personal
  name was replaced with “Unnamed profile”.

### Historical states and saved decisions

- Added `TwinState`, `DecisionRun` and `DecisionEvent`, with Alembic migration
  `20261005_decisions`, model registration and user relationships.
- Profile changes and wallet/GitHub sync capture dated states. Explicit state
  capture and monthly CSV import are also available.
- Saved runs preserve their selected inputs, request, forecast metadata, seed and
  result. Later profile changes, feedback and outcome corrections do not rewrite
  the original projection through the application workflow.
- Owned APIs under `/users/{user_id}/decisions` support state capture/listing,
  history import, decision creation/listing/detail/deletion, feedback and outcomes.
- Account/decision deletion removes the associated historical records as defined
  by their relationships. History is retained until its owning records are deleted.

### Simulation and explanations

- Integrated scenarios cover savings goals, job switches, higher studies and
  lifestyle budgets. Each compares a baseline with a proposed change.
- Job/study scenarios use entered take-home income, transition costs and income
  gaps. Lifestyle scenarios model spending and planned activity, not medical effects.
- Cash flow uses starting cash plus income minus expenses across full future
  calendar months, excluding the unfinished current month.
- Contributions reconcile to the final balance difference. Spending-reduction
  counterfactuals are rerun to check whether they reach the requested target.
- Optional seeded Monte Carlo varies expenses and reports percentile paths and
  conditional target attainment. Income/employment assumptions remain fixed.
- Supported currencies are INR, USD, EUR and GBP, without conversion. Mixed-currency
  wallet totals are rejected for projection. Requests are bounded to 120 months
  and 5,000 Monte Carlo paths.

### Expense forecasting and evaluation

- Monthly history imports use consecutive completed `month,income,expense` rows,
  source attribution and permission confirmation, bounded to 120 months/100 KB.
- Per-user Ridge expense regression competes with a trailing-three-month mean.
  At least 12 months are required. Rolling validation promotes Ridge only when
  MAE improves by more than 5%; insufficient/stale data has disclosed fallbacks.
- Saved metadata includes fitted parameters, library version, data hash and
  bounds. Intercept/time/clipping contributions reconcile to the expense forecast.
- The offline evaluation script supports a separate held-out test period, a
  calendar gap matching live decisions, training-only model selection, baseline
  comparisons, MAE/RMSE, provenance declarations and dataset hashes.
- These tools are implemented; no audited real dataset or real-world accuracy
  result is documented. Synthetic fixtures verify behavior only.

### Feedback and observed outcomes

- Runs accept feedback and observed savings for completed projection month-ends,
  separately for baseline and alternative strategies.
- Outcome summaries include count, MAE, RMSE, mean signed error and monthly
  comparisons. Empty summaries return null metrics.
- Latest corrections drive metrics while earlier events remain in history.
  Negative balances and notes are supported. Feedback does not automatically retrain.
- The UI displays summaries, expandable comparisons, correction status and an
  empty state before any projected month is complete. JSON export includes the report.
- Savings deviations are not isolated expense-model accuracy or causal evidence.

### Frontend workflow and visual refresh

- **Simulations** is the default signed-in workspace. Its tabs are **New simulation**,
  **Saved simulations**, **Calculators**, **Profile history** and **Expense data**.
  The previous competing Decisions/Simulations navigation was consolidated.
- Starting finances are visible before submission, with a setup shortcut when the
  financial profile is missing. Goal/change fields are grouped, technical settings
  are collapsed, comparison labels use plain language and results receive focus.
- Earlier standalone vehicle/home loan, investment, education, job, startup,
  fitness and sleep calculators remain available under **Calculators**.
- Shared styling covers authentication, overview, profiles, dialogs and simulations:
  light surfaces, teal actions, compact controls, responsive grids/tables, mobile
  navigation, keyboard focus, named icon controls and constrained dialog scrolling.
- System fonts replace the external font request. Outcome tables adapt to narrow screens.

## Verification evidence

Chat prototype verification on October 10, 2026: 71 backend tests passed, including
chat arithmetic, ownership, evidence validation, concurrent-write protection and
the new migration's SQLite round trip. All 16 desktop/mobile browser cases passed
against a disposable SQLite-backed API with an explicitly substituted Ollama
endpoint. The existing running-API smoke test and the production frontend build
also passed. Browser screenshots were inspected. These checks do not establish
live Qwen interpretation quality, live Wallet behavior, a PostgreSQL migration
execution, or deployed operation. The model smoke script is provided for the laptop.

On October 10, branch preparation reran all 47 backend tests and the frontend
production build successfully; dependency deprecation warnings remain. Whitespace
checks also passed. Browser tests, live integrations, migrations and remote CI
were not rerun.

The table below lists historical results recorded in
[implementation_progress.md](docs/implementation_progress.md). Counts apply to
their recorded checkpoints.

| Checkpoint | Recorded result |
| --- | --- |
| Wallet/auth fixes | 16 backend tests passed; live wallet acceptance remained open. |
| Integrated decision prototype | 38 backend tests and frontend build passed; local PostgreSQL migrated. Initial browser/live API attempts were blocked. |
| Browser and held-out evaluation follow-up | 44 backend tests, four desktop/mobile browser tests and live API smoke passed; disposable account removed. |
| Observed outcome backend | 47 backend tests passed, including correction handling and unchanged projections. |
| Observed outcome screen | Six desktop/mobile browser tests and production build passed. Historical correction journey used mocked historical responses. |
| Shared visual refresh | 10 desktop/mobile browser tests and production build passed; layout checks at 320, 768 and 1440 px and screenshot review recorded. |
| Unified workflow | October 6 entry documents the workflow change; it records no new test-run result. |

The current browser source defines six tests across desktop and mobile projects;
this inventory is not a claim that all 12 current cases have been executed.
Backend coverage includes ownership, validation, migrations, immutable runs,
forecast selection, seeded simulations, imports, held-out isolation and outcomes.

`.github/workflows/ci.yml` defines backend tests, PostgreSQL migration round trips,
a live API smoke test, browser journeys with artifacts, and the frontend build.
A successful remote CI execution is not established by the local documentation.

For repeatable checks, use the commands in [decision-engine.md](docs/decision-engine.md).
Browser tests require the backend and normally start a dedicated Vite server on
port 5174. The live smoke script creates and removes a disposable synthetic account.

## Remaining work

- Audit permission-cleared real monthly data and publish appropriate held-out evidence.
- Verify the live Persona Wallet flow and establish category/coverage semantics
  before turning wallet transactions into automatic training history.
- Develop and validate learned career/health models if required by the proposal.
  Existing career inputs and health calculators do not establish those capabilities.
- Complete notifications, usability evaluation, deployment and the academic report.
- Confirm remote CI results and rerun checks for subsequent implementation changes.
- Retain model limitations in the report: short personal histories, trend-only
  forecasting, uncalibrated expense uncertainty and no causal or medical claims.

## Main implementation files

| Area | Files |
| --- | --- |
| API and persistence | `backend/app/api/decisions.py`, `backend/app/models/decision.py`, `backend/app/schemas/decision.py`, `backend/alembic/versions/20261005_decisions.py` |
| State and scenarios | `backend/app/services/twin_state_service.py`, `backend/app/services/decision_service.py` |
| Forecast and evaluation | `backend/app/services/forecast_service.py`, `backend/app/services/expense_evaluation.py`, `backend/app/services/outcome_service.py` |
| Operational checks | `backend/scripts/evaluate_expenses.py`, `backend/scripts/smoke_decisions.py`, `.github/workflows/ci.yml` |
| Frontend | `frontend/src/main.jsx`, `frontend/src/DecisionWorkspace.jsx`, `frontend/src/DecisionOutcomes.jsx`, `frontend/src/styles.css`, `frontend/src/decisions.css` |
| Verification | `backend/tests/`, `frontend/tests/`, `frontend/playwright.config.js` |

See [file-guide.md](docs/file-guide.md) for the wider source map.

## Documentation map

- [Implementation progress](docs/implementation_progress.md): dated development checkpoints.
- [Frontend workflow](docs/frontend-workflow.md): navigation and a repeatable demo.
- [Decision engine](docs/decision-engine.md): contracts, model card, assumptions and checks.
- [Expense evaluation](docs/expense-evaluation.md): dataset audit and holdout protocol.
- [Bank ledger sync](docs/bank-ledger-sync.md): wallet mapping and refresh behavior.
- [Project workflow](docs/project-workflow.md), [requirements map](docs/requirements-map.md)
  and [20-day delivery plan](docs/delivery-20-days.md): scope, acceptance and remaining schedule.

The working tree contains modified and untracked implementation files. This
snapshot does not establish that they have been committed, pushed or deployed.
