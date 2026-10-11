# PersonaTwin Development Workflow

Updated: 2026-10-05. Aligned with the user's 20-page project PDF.

Current checkpoint: an integrated prototype now implements much of P1-P4 and the
career-finance part of P5. See [implementation progress](implementation_progress.md)
for verified results and [decision-engine.md](decision-engine.md) for limitations.
Stage acceptance remains open where browser, real-data or research evaluation is
missing. The user confirmed React and a 20-day deadline; use the
[20-day schedule](delivery-20-days.md) for current priorities.

Use the [requirements map](requirements-map.md) for source pages, code evidence,
scope decisions and acceptance examples. This replaces the earlier workflow:
trained prediction, explainability, twin history and feedback are core work.

## Delivery Sequence

Personal data -> historical twin state -> decision engine -> prediction and
simulation -> explanation and recommendation -> saved outcome and feedback.

Complete the financial savings-goal flow first, then extend it across domains.
The stages below are dependency order, not calendar commitments.

## P0: Verify the Foundation

Requirements: R1, R12. Run alongside P1 design.

- [ ] Verify live wallet sync, balances/history, timestamp, reload and reconnect.
- [ ] Verify failed sync preserves the last successful data and exposes staleness.
- [ ] Check sign-in, profile persistence, logout and expired sessions.
- [ ] Record backend tests and frontend build results.

Exit: recorded evidence for the data journey. Fixtures can unblock development
during external outages, but live verification stays open.

## P1: Define and Persist Financial Twin State

Requirements: R1, R2, R9. First implementation stage.

- [ ] P1.1 Define typed state and savings-goal contracts, units, periods, provenance, missing-data rules and overrides.
- [ ] P1.2 Normalize wallet history, transfers and incomplete periods with representative fixtures.
- [ ] P1.3 Add immutable owned state records and an Alembic migration; specify capture behavior for syncs and manual edits.
- [ ] P1.4 Expose state retrieval and test ownership, history and failed-update preservation.
- [ ] P1.5 Verify migrations against fresh and existing PostgreSQL test databases.

Exit: successive updates preserve historical states; decisions can reference
unchanging inputs. Credentials are excluded from snapshots.

## P2: Deliver a Deterministic Financial Decision

Requirements: R3, R4, R6, R9, R10. Depends on P1.

- [ ] Build the decision service to load an owned state and resolve assumptions.
- [ ] Calculate monthly baseline and spending-reduction trajectories toward a goal.
- [ ] Return exact inputs, shortfall/surplus, formula version and calculation explanations.
- [ ] Persist runs and expose owned history.
- [ ] Add goal entry, comparison, explanation and saved results to the existing UI.
- [ ] Verify the 80,000 versus 92,000 fixture in the requirements map, invalid inputs and reproducibility after later syncs.

Exit: a user can run and revisit an explained comparison. Label this intermediate
delivery deterministic; it does not complete the ML requirement. Preserve existing
scenario behavior while introducing the new flow.

## P3: Add Evaluated Forecasting and Uncertainty

Requirements: R4, R5, R11. Depends on P1-P2.

- [ ] Audit datasets/history for provenance, permission, coverage, currency and target suitability.
- [ ] Build reproducible preparation/training with chronological validation and leakage checks.
- [ ] Compare an interpretable expense model against a naive baseline; set quality thresholds before held-out evaluation.
- [ ] Version artifacts, feature definitions, dataset references, metrics and limitations.
- [ ] Integrate forecasts, exposing insufficient-history fallback.
- [ ] Use established numerical libraries for bounded, seeded Monte Carlo with documented distributions and shared draws across scenarios.
- [ ] Show percentiles and conditional goal attainment; verify reproducibility and the zero-uncertainty limit.

Exit: evaluated predictions feed saved simulations. Report measured performance
honestly; synthetic demonstrations do not establish real-world predictive quality.

## P4: Complete Explainability and Feedback

Requirements: R6-R9. Depends on P2-P3.

- [ ] Add model-appropriate attribution tied to the exact prediction/version.
- [ ] Compute and rerun feasible counterfactuals, reporting when none meets the goal.
- [ ] Produce recommendations from personal constraints and quantified differences.
- [ ] Save accept/reject feedback and comparable later observed outcomes.
- [ ] Measure forecast error; evaluate candidate updates before model promotion.
- [ ] Verify explanation fidelity, recommendation feasibility and access control.

Exit: demonstrate finance from data through prediction, simulation, explanation,
feedback and observed-outcome comparison. LLM wording/chat remains optional.

## P5: Extend Across Domains and Complete the UI

Requirements: R1-R10. Depends on the validated financial flow.

- [ ] Implement job-switch effects on finances using current salary, transition costs, employment gaps, expenses and goals.
- [ ] Select/evaluate career models only where suitable data supports prediction.
- [ ] Define the health/lifestyle demonstration and evidence requirements before expanding heuristics.
- [ ] Apply shared history/explanation contracts and numerical validation to other scenarios.
- [ ] Resolve the PDF's Flutter proposal versus the existing React implementation before any rewrite.
- [ ] Decide goal-notification and optional chat scope.
- [ ] Verify loading, empty, error and stale states, accessible controls, and desktop/mobile browser journeys.

Exit: demonstrate cross-domain decisions and agreed domain coverage without
presenting unvalidated scores as learned predictions.

## P6: Evaluate and Release

Requirements: R11-R12. Verification continues throughout development.

- [ ] Automate backend, PostgreSQL migration, frontend build and browser checks.
- [ ] Assemble model metrics, scenario correctness and explanation-fidelity evidence.
- [ ] Run a consent-based usability evaluation and document limitations.
- [ ] Review ownership, consent, deletion behavior and credential/log handling.
- [ ] Document clean setup, configuration names, deployment, backups and rollback.
- [ ] Prepare architecture diagrams, dataset/model documentation, report and repeatable demo.

Exit: reproducible build and evidence-backed demonstration of the core PDF
capabilities. Deployment is a separate action against an identified target.

## Working Loop

1. Pick an item from the earliest unblocked stage and cite requirement IDs.
2. Specify inputs, outputs, affected modules and acceptance checks.
3. Follow the existing feature/fix branch flow into develop, then tested releases into main.
4. Implement a focused change and migration when needed.
5. Run appropriate code, numerical, model or browser checks.
6. Record evidence/limitations in the progress log and update this checklist.

File existence does not establish completion. Close stages only against exit
criteria; keep external blockers visible while progressing independent work.

## Local Commands

From backend with its existing virtual environment and test tools:

```bash
.venv/bin/alembic current
.venv/bin/alembic upgrade head
PYTHONPATH=. .venv/bin/pytest tests
.venv/bin/uvicorn app.main:app --reload
```

Select the intended database before migrating. Inspect unknown revisions before
changing version stamps. Wallet tests use SQLite; PostgreSQL verification is
separate. Pytest must be installed in the environment.

From frontend, in another terminal:

```bash
npm ci
npm run build
npm run dev
```

Use Vite's printed URL (configured port 5173). Its development proxy expects the
backend on port 8000. Add model/browser test commands when their tooling exists.

## Immediate Next Task

**Audit permission-cleared monthly expense data and run independent held-out
evaluation** using [expense-evaluation.md](expense-evaluation.md). Four desktop/mobile
browser tests and the disposable-account API smoke test passed on October 5.
P1.1 contracts have been implemented. Complete P0 live wallet verification in parallel.
