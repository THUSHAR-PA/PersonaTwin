# PersonaTwin Requirements Map

Updated: 2026-10-05

Implementation checkpoint: the integrated decision prototype now supplies historical
states, owned saved runs, financial/career scenario comparisons, per-user expense
model evaluation, seeded uncertainty, linear attribution, counterfactuals and
feedback/outcomes. See [decision-engine.md](decision-engine.md) for exact behavior
and limitations. The table below records the original gap assessment; it is not a
claim that these features are still absent. Remaining research/deployment work is
tracked in [delivery-20-days.md](delivery-20-days.md).

Source: the user's 20-page *PersonaTwin: An Explainable AI Personal Decision
Simulator Using Human Digital Twin Technology* PDF. Page numbers below refer to
the document. This maps its proposed system to the repository; its literature
claims and candidate datasets have not been independently verified.

## Requirements and Gaps

| ID | PDF requirement | Current evidence | Required work and completion evidence |
| --- | --- | --- | --- |
| R1 | Personal data and profiles (pp. 7, 13) | Models, profile APIs, wallet/GitHub services | Verify live integration and profile persistence; track sources, currency, units, missing values and freshness. |
| R2 | Evolving twin with history (pp. 7-8, 13) | `backend/app/twin/digital_twin.py`; latest financial snapshot | Persist immutable dated states. Later updates must preserve the inputs used for earlier decisions. |
| R3 | Decision orchestration across domains (pp. 7, 13) | `backend/app/api/simulation.py` and `twin.py` route requests | Coordinate state, prediction, simulation and explanation; demonstrate finance first, then career-to-finance effects. |
| R4 | Scenario comparison and uncertainty (pp. 5, 13-14) | Eight formula handlers in `backend/app/services/simulation_service.py` | Add baseline/alternative trajectories and seeded Monte Carlo. Test numerical examples, reproducibility and uncertainty bounds. |
| R5 | Trained predictions (pp. 6-7, 14, 17) | `DigitalTwin.predict()` returns generic text | Build dataset preparation, training, versioned inference and held-out evaluation against a simple baseline. |
| R6 | Explainability (pp. 3, 7-8, 14, 18) | Basic rules and recommendation strings | Add calculation traces, model-appropriate attribution and recomputed counterfactuals tied to the exact result. |
| R7 | Personalized recommendations (p. 14) | Embedded handler rules; recommendation service is empty | Use personal constraints and quantified scenario differences; provide a supporting reason for each action. |
| R8 | Feedback and outcomes (p. 8) | No dedicated implementation | Save user feedback and later observations; compare actual outcomes with forecasts and evaluate model updates before promotion. |
| R9 | Persistent decision history (pp. 8, 14) | PostgreSQL, Alembic and profile models | Store owned states, runs, model/formula versions and feedback. Verify migrations, access control and historical reproducibility. |
| R10 | Interactive UI (pp. 8, 14-15) | React/Vite dashboard in `frontend/src/main.jsx` | Add comparisons, uncertainty, explanations and history; verify desktop/mobile journeys. PDF proposes Flutter: record this stack difference. |
| R11 | Datasets and research evaluation (pp. 15-18) | Backend tests; no training pipeline | Document data provenance/license, preprocessing, temporal splits, metrics, model limitations and usability evaluation. |
| R12 | Secure, reproducible release (pp. 8, 17-18) | Authentication and ownership checks, migrations | Broaden route checks; automate tests/builds; document clean setup, deployment, backups and rollback. |

Existing code is partial evidence, not proof of completion. The preceding backend
run passed 16 tests; live wallet sync remains unconfirmed. Current twin scores are
heuristics, not trained predictions.

## Scope Interpretation

- Core: synchronized state, trained prediction, simulations, explanations, recommendations, saved history, feedback and evaluation.
- First delivery: finance, followed by a career-finance decision and the agreed health/lifestyle scope. Finance is not the whole project.
- Optional: conversational chat (p. 15). LLM-generated wording does not replace prediction or XAI.
- Later: autonomous actions, voice, AR/VR and broad ecosystem integration (p. 19).
- Algorithm names in the research survey are options, not a requirement to implement every method. Select based on suitable data and evaluation.
- Continue React for now; confirm whether Flutter is mandatory for the academic deliverable before any rewrite.

## First Complete Flow: Savings Goal

Proposed implementation, based on the savings examples on pp. 5, 7-8 and 14:
**Can I reach a savings target by a chosen date, and what changes if I reduce monthly spending?**

1. Sync and normalize wallet data into a dated financial state.
2. Validate the goal, currency, income, expenses and available history.
3. Forecast expenses using an evaluated model where data is sufficient; otherwise expose a labeled deterministic fallback.
4. Compare baseline and reduced-spending trajectories from the same state.
5. Add uncertainty with documented assumptions and a saved random seed.
6. Explain drivers, calculation differences and a feasible counterfactual.
7. Save the decision, collect feedback and compare with later observed outcomes.

### Proposed Data Contracts

These are design targets, not existing records or endpoints.

| Record | Required contents |
| --- | --- |
| Financial state | Owner, ID, observation/capture times, currency, normalized values, sources, completeness and schema version; no credentials |
| Decision request | State ID, savings target/date, explicit overrides and bounded spending reduction |
| Decision run | Owner, state ID, effective inputs, assumptions, data cutoff, model/formula versions, random seed/sample count when applicable, both trajectories/results |
| Explanation | Calculation trace, model attribution where applicable, verified counterfactual and limitations |
| Feedback/outcome | Owner, run ID, response/time, observed period and values, comparable forecast error |

Use explicit monthly periods and currency. Distinguish transfers from income and
spending, incomplete months from complete observations, liquid cash from
investments, and missing values from measured zeros. Do not double-count debt
payments already included in expenses.

### Acceptance Examples

- Starting cash 20,000, monthly income 50,000 and expenses 40,000 over six months at zero interest produce 80,000. Reducing expenses by 2,000/month produces 92,000: a 90,000 target is reached only by the alternative.
- A later sync cannot alter a saved decision. Another user cannot retrieve it or submit feedback on it.
- Invalid dates, mixed unsupported currencies, non-finite amounts and infeasible reductions produce validation errors.
- Insufficient/stale data is visible; it never silently becomes a trained prediction.
- Identical inputs, versions and seed reproduce simulations. Zero uncertainty matches deterministic results; percentiles are ordered and probabilities bounded.
- Forecast evaluation uses chronological splits without leakage. Set numerical quality thresholds before inspecting held-out results; report comparison with a naive baseline even if the trained model loses.
- Rerun each claimed counterfactual through the engine; report when no feasible change meets the goal.

## Decisions to Resolve

Before model work: inspect dataset availability, permission, history length and
relevance, then define minimum history, freshness and evaluation thresholds.
Before expanding domains: confirm the academic deadline, required health/career
demonstrations and Flutter requirement. No delivery dates or dataset suitability
are assumed. Live verification needs a user-controlled test wallet; fixtures let
development proceed but do not close that check.

Follow [project-workflow.md](project-workflow.md) for implementation order.
