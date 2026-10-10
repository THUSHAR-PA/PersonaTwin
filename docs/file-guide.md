# PersonaTwin File Guide

Updated: 2026-10-05. This is a map of the source files currently in the project,
not a list of features promised by the proposal. Paths are relative to the
repository root. **Scaffold** means the file is empty or not connected to the
running application. Generated directories such as `node_modules`, `dist`, virtual
environments, caches and Playwright results are not source files.

## How a Request Travels

1. `frontend/src/main.jsx` shows the React application. The Decisions screen lives
   in `frontend/src/DecisionWorkspace.jsx`.
2. Vite sends API calls to FastAPI. `backend/app/main.py` registers the API routers.
3. An `api/` file checks the request, authentication and user ownership. The
   matching `schemas/` file validates input and shapes responses.
4. A `services/` file performs business logic. It reads and writes `models/`
   through the database session. `alembic/versions/` tracks table changes.
5. The API returns data to React, which renders profiles, comparisons and charts.

For example, a savings comparison follows
`DecisionWorkspace.jsx` -> `api/decisions.py` -> `services/decision_service.py`
and `services/forecast_service.py` -> `models/decision.py` -> PostgreSQL.

## Root and Automation

| File | Purpose |
| --- | --- |
| `Readme.md` | Product overview and project entry point. Parts of its original roadmap and example folder tree are historical, so use the workflow docs for current status. |
| `CURRENT_STATE.md` | Older snapshot of the project; useful for history, not current implementation status. |
| `.gitignore` | Excludes secrets, local environments, installed packages, builds and test output from Git. |
| `.github/workflows/ci.yml` | GitHub Actions checks: backend tests, PostgreSQL migration round trip, disposable-account API smoke test, desktop/mobile browser tests and frontend build. These checks run when the workflow is triggered on GitHub. |
| `database/schema.sql` | Reference SQL for the original database design. Alembic migrations and SQLAlchemy models govern the current application schema. |

## Backend Startup and Configuration

| File | Purpose |
| --- | --- |
| `backend/app/main.py` | Creates the FastAPI app, configures CORS, registers routers and serves `/healthz`. |
| `backend/app/database/base.py` | Shared SQLAlchemy declarative base used by model classes. |
| `backend/app/database/connection.py` | Loads `backend/.env`, reads `DATABASE_URL`, builds the SQLAlchemy engine and session factory. |
| `backend/app/database/session.py` | FastAPI `get_db` dependency: opens one database session for a request and closes it afterward. |
| `backend/app/database/__init__.py` | Empty package marker. |
| `backend/app/auth/security.py` | Password hashing/checking, JWT creation/decoding and credential authentication. |
| `backend/app/dependencies/auth.py` | Resolves the signed-in user from the bearer token and checks ownership of user-specific resources. |
| `backend/requirements.txt` | Runtime Python dependencies, including FastAPI, SQLAlchemy, NumPy and scikit-learn. |
| `backend/requirements-dev.txt` | Runtime dependencies plus pytest for development and CI. |
| `backend/.env` | Local database URL, signing secret and optional integration configuration. It is ignored by Git; never paste its values into documentation. |

## Backend API Routes

An `api/` file declares HTTP routes. It should delegate calculations and database
work to the relevant service.

| File | Purpose |
| --- | --- |
| `backend/app/api/auth.py` | `/auth` registration, login and current-user routes. |
| `backend/app/api/users.py` | User account and profile routes, including update and deletion. |
| `backend/app/api/finance.py` | Financial profile CRUD plus Persona Wallet sign-up, login, account creation and sync routes. |
| `backend/app/api/career.py` | Career profile CRUD and GitHub profile sync route. |
| `backend/app/api/health.py` | Health profile CRUD routes. |
| `backend/app/api/twin.py` | Assembles the older twin summary and its job-switch simulation endpoint from current profiles. |
| `backend/app/api/simulation.py` | Dispatches eight standalone formula simulations by domain and type. |
| `backend/app/api/decisions.py` | Owned historical states, CSV history import, saved comparisons, feedback and outcome routes. |
| `backend/app/api/analytics.py` | **Scaffold:** empty and not registered in `main.py`. Current overview metrics are calculated in the frontend. |

## Database Models and Request Schemas

`models/` describes stored tables and relationships. `schemas/` describes the
input/output accepted by the HTTP API; changing a schema does not itself change a
database table.

| File | Purpose |
| --- | --- |
| `backend/app/models/__init__.py` | Imports model classes so they register with SQLAlchemy and Alembic. |
| `backend/app/models/user.py` | Users, identity fields, password hash and relationships to their profiles and historical states. |
| `backend/app/models/financial_profile.py` | Current finance values, latest wallet snapshot and last successful wallet-sync time. |
| `backend/app/models/career_profile.py` | Role, experience, salary expectation, skills and certifications. |
| `backend/app/models/health_profile.py` | Height, weight, sleep and exercise profile values. |
| `backend/app/models/decision.py` | `TwinState` snapshots, `DecisionRun` requests/results and `DecisionEvent` feedback/outcomes. |
| `backend/app/models/understanding_models.md` | Explanatory notes on SQLAlchemy models; documentation, not executable code. |
| `backend/app/schemas/user.py` | User registration, login, update, response and token data models. |
| `backend/app/schemas/financial_profile.py` | Financial profile validation/response plus wallet login, sign-up, account and sync request models. |
| `backend/app/schemas/career_profile.py` | Career CRUD and GitHub sync request models. |
| `backend/app/schemas/health_profile.py` | Health CRUD request/response models. |
| `backend/app/schemas/decision.py` | State capture, monthly CSV import, scenario, feedback and observed-outcome validation. |

## Backend Services and Twin Logic

| File | Purpose |
| --- | --- |
| `backend/app/services/user_service.py` | Creates, looks up, updates and deletes users; captures a new twin state after identity edits. |
| `backend/app/services/finance_service.py` | Financial CRUD, Persona Wallet HTTP calls, summary validation and persistence of the latest wallet snapshot. Successful profile changes capture a twin state. |
| `backend/app/services/career_service.py` | Career CRUD and GitHub data import; captures state after profile changes. |
| `backend/app/services/health_service.py` | Health CRUD and state capture after profile changes. |
| `backend/app/services/twin_state_service.py` | Builds historical state from current profiles and wallet metadata; validates monthly CSV observations. |
| `backend/app/services/forecast_service.py` | Evaluates a per-user Ridge expense trend against a trailing-mean baseline, chooses the supported forecast and records model details. |
| `backend/app/services/decision_service.py` | Calculates monthly baseline/alternative cash paths, optional Monte Carlo expense variation, explanations, counterfactuals and recommendations. |
| `backend/app/services/simulation_service.py` | Standalone investment, vehicle/home loan, higher studies, job switch, startup, fitness and sleep formulas used by `/simulation`. |
| `backend/app/services/recommendation_service.py` | **Scaffold:** empty. Current recommendations are returned by the decision and simulation services. |
| `backend/app/twin/digital_twin.py` | Older in-memory twin summary, heuristic scores and job-switch dispatch. Its `predict()` returns a description, not a trained prediction. |
| `backend/app/twin/twin_builder.py` | **Scaffold:** empty. |
| `backend/app/twin/twin_loader.py` | **Scaffold:** empty. |
| `backend/app/twin/twin_state.py` | **Scaffold:** empty; historical state is now implemented in `models/decision.py` and `services/twin_state_service.py`. |
| `backend/app/simulation/bike.py` | **Scaffold:** empty; vehicle-purchase formula lives in `services/simulation_service.py`. |
| `backend/app/simulation/higher_studies.py` | **Scaffold:** empty; the standalone formula lives in `services/simulation_service.py`. |
| `backend/app/simulation/job_switch.py` | **Scaffold:** empty; the standalone formula lives in `services/simulation_service.py`. |

## Database Migrations

Run migrations from `backend/` with `alembic upgrade head` against the intended
database. Migration filenames contain revision identifiers; their order is defined
by each file's `down_revision`.

| File | Purpose |
| --- | --- |
| `backend/alembic.ini` | Alembic command-line configuration. |
| `backend/alembic/env.py` | Connects Alembic to the configured database and the models' metadata. |
| `backend/alembic/script.py.mako` | Template for generating new migration files. |
| `backend/alembic/README` | Alembic folder note. |
| `backend/alembic/versions/e669ee76d77b_initial_database_schema.py` | Creates the first user and profile tables. |
| `backend/alembic/versions/45758687e8f0_make_user_profile_fields_nullable.py` | Makes selected user profile fields optional. |
| `backend/alembic/versions/67441a5ef7db_add_hashed_password_to_users.py` | Adds the user password-hash column. |
| `backend/alembic/versions/20261003_wallet_snapshot.py` | Adds the wallet snapshot and last-sync timestamp to financial profiles. |
| `backend/alembic/versions/20261005_decisions.py` | Adds historical states, saved decision runs and feedback/outcome events. |

## Backend Scripts and Tests

| File | Purpose |
| --- | --- |
| `backend/scripts/evaluate_expenses.py` | Runs the expense-forecast evaluation on an explicitly supplied monthly CSV. |
| `backend/scripts/smoke_decisions.py` | Exercises the running API with a disposable synthetic account, then deletes it. |
| `backend/tests/test_digital_twin.py` | Checks twin aggregation and job-switch behavior. |
| `backend/tests/test_wallet_sync.py` | Checks wallet data mapping, repeat sync, failure handling, authentication and the wallet migration. |
| `backend/tests/test_decisions.py` | Checks calculations, forecast selection, Monte Carlo, saved-history ownership, imports, feedback and outcomes. |
| `backend/tests/test_decision_migration.py` | Checks creation and reversal of decision tables while preserving an existing user. |

## Frontend and Browser Tests

| File | Purpose |
| --- | --- |
| `frontend/index.html` | HTML document with the root element where React mounts. |
| `frontend/src/main.jsx` | Main React application: login, overview, profiles, wallet/GitHub controls and standalone simulations. Registers the Decisions view. |
| `frontend/src/DecisionWorkspace.jsx` | Financial/career/lifestyle decision forms, saved state/run lists, expense CSV import, projection canvas, explanations, feedback and outcomes. |
| `frontend/src/icons.jsx` | Shared custom marks and navigation icons. |
| `frontend/src/styles.css` | Existing application styling and responsive layout. |
| `frontend/src/decisions.css` | Styling and responsive layout for the Decisions view. |
| `frontend/src/file.jpe` | Existing bitmap asset in the frontend source tree; no current frontend source file references it. |
| `frontend/vite.config.js` | Vite and React setup; proxies API requests to backend port 8000 during development. |
| `frontend/package.json` | Frontend dependencies and `dev`, `build`, `preview` and browser-test scripts. |
| `frontend/package-lock.json` | Exact installed npm dependency versions for reproducible installs. Generated by npm. |
| `frontend/playwright.config.js` | Browser-test projects, local URL and optional development-server startup. |
| `frontend/tests/decisions.spec.js` | Desktop/mobile browser journeys for decision creation, chart rendering, feedback, history and invalid inputs. |

## Project Documentation

| File | Purpose |
| --- | --- |
| `docs/file-guide.md` | This file-by-file map. |
| `docs/requirements-map.md` | Maps the supplied PDF to existing code, gaps and acceptance examples. |
| `docs/project-workflow.md` | Ordered development stages and completion checks. |
| `docs/delivery-20-days.md` | The current 20-day delivery schedule and evidence priorities. |
| `docs/decision-engine.md` | Decision formulas, model card, limitations and verification commands. |
| `docs/bank-ledger-sync.md` | Persona Wallet summary contract, UI sync behavior and deployment notes. |
| `docs/database_models.md` | Original database-model design notes. |
| `docs/alembic.md` | Database migration usage notes. |
| `docs/implementation_progress.md` | Dated progress record, including older historical entries. |

For what to edit next, start with `docs/project-workflow.md`. For the exact current
behavior of a decision, start with `docs/decision-engine.md`.
# Evaluation Additions (October 5)

- `docs/frontend-workflow.md`: navigation map, worked simulation example and
  remaining research scope after the October 6 simulation-workspace consolidation.

- `frontend/src/DecisionOutcomes.jsx`: observed savings metrics and monthly
  comparisons, completed-period entry, notes and correction handling.

- `backend/app/services/outcome_service.py`: compares reported monthly savings
  with saved projections, deduplicates corrections and summarizes errors by strategy.
- `backend/tests/test_outcome_service.py`: tests empty outcomes, corrections,
  branch isolation and negative balances.

- `backend/app/services/expense_evaluation.py`: independent fixed-origin expense
  evaluation with a reserved test period, training-only selection and error metrics.
- `backend/tests/test_expense_evaluation.py`: checks split dates, leakage protection,
  baseline fallback and invalid splits using synthetic data.
- `frontend/tests/check-servers.js`: preflight backend/frontend availability checks
  before browser tests.
- `docs/expense-evaluation.md`: dataset audit requirements and evaluation commands.
