# PersonaTwin: Frontend Workflow

Updated October 6, 2026. React is the agreed frontend.

## Where the Simulation Is

Open **Simulations** in the navigation. The former **Decisions** workspace is now
the **New simulation** tab. It is also the default screen after signing in.
No APIs or saved database records were renamed.

| Tab | Purpose |
| --- | --- |
| New simulation | Compare current finances with a savings, job-switch, higher-studies or lifestyle-budget plan. |
| Saved simulations | Reopen an unchanged result, its explanation, feedback and observed outcomes. |
| Calculators | Earlier finance, career and health formula tools, including vehicle/home loans, investment, studies, job change, startup, fitness and sleep. These do not create the saved comparisons above. |
| Profile history | Inspect dated inputs and select a previous confirmed-currency snapshot. |
| Expense data | Import permission-cleared monthly CSV data for expense forecasting. |

## First Demonstration

1. Open **Profiles > Financial**, edit and save monthly income of 50,000, expenses
   of 40,000 and current savings of 20,000. These are demonstration assumptions.
2. Open **Simulations > New simulation**. Verify the starting finances.
3. Choose **Savings goal**, projection months **6**, savings target **90,000** and
   monthly spending reduction **2,000**.
4. Under **Data and forecast settings**, select the appropriate currency and
   **Saved profile assumption**. Leave expense variation at zero.
5. Click **Run simulation**. The saved result should show **80,000** for
   **Keep current plan**, **92,000** for **With this change**, and **12,000** difference.
6. Inspect the projection, contributing factors and recommendations. Save feedback
   and reopen the result through **Saved simulations**.

Projection months are full future months; the unfinished current month is skipped.
Observed savings can only be recorded after the corresponding month has completed.
The original prediction stays unchanged when observations or corrections are added.

## What the Results Mean

- **Keep current plan:** projected savings without the proposed change.
- **With this change:** projected savings with the supplied scenario assumptions.
- **Monthly saving needed:** a recalculated spending reduction that meets the
  savings target from the current plan, where feasible. This is the counterfactual.
- **Data and forecast settings:** currency, historical starting state and forecast
  selection. Insufficient or stale history produces a disclosed fallback.
- **Uncertainty assumptions:** optional seeded expense variation, not a guarantee
  or an empirically calibrated probability of success.

## PDF Scope Still Open

The interface now unifies implemented features; that is not completion of the
whole research proposal. Remaining evidence/work includes real-data evaluation,
learned career/health predictions, verified wallet acceptance and category-safe
history normalization, notifications, usability evaluation, deployment and the
academic report. Health calculators are heuristics; career scenarios use entered
income assumptions, not learned salary predictions. Lifestyle simulation currently
models budget effects, not health outcomes.

See [delivery-20-days.md](delivery-20-days.md) and
[requirements-map.md](requirements-map.md) for the project scope.
