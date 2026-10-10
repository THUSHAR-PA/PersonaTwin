# Twenty-Day Delivery Plan

User constraints: React retained; 20 days remain. Day numbers are relative to the
confirmed start, not a promise that research outcomes can be predetermined.

| Days | Deliverable | Acceptance |
| --- | --- | --- |
| 1-3 | Integrated financial decision prototype and history | State, comparison, forecast, explanation and feedback exercised end to end |
| 4-6 | Real dataset audit and expense evaluation | Document permission, provenance, units, temporal coverage, baseline and independent held-out results |
| 7-9 | Career-finance scenarios and candidate career model | Validate income-gap/transition calculations; only add learned salary/role predictions if appropriate data and evaluation support them |
| 10-11 | Agreed health/lifestyle demonstration | Define inputs/outcomes; validate the chosen model or explicitly limit the feature to measured habits and budget planning |
| 12-13 | Explanation and feedback evaluation | Verify numerical attribution/counterfactuals and observed-outcome comparison; collect consent-based usability feedback |
| 14-16 | Full browser and data-boundary testing | Desktop/mobile journeys, migrations, ownership, failure recovery and performance checks |
| 17-18 | Staging and reproducibility | Clean setup, backup/migration/rollback exercise and repeatable demo |
| 19-20 | Report, presentation and buffer | Evidence-backed claims, limitations, architecture diagrams and recorded demonstration |

## Implemented Starting Point

The code now includes immutable state/decision history; savings, job-switch,
education and lifestyle cash-flow comparisons; per-user expense model evaluation;
seeded uncertainty; faithful linear attribution and calculated counterfactuals;
feedback/outcome storage; and an integrated React Decisions view.

This does not complete every PDF capability. Outstanding items include verified
real-data performance, career/health predictive models, live wallet acceptance,
automatic category-safe wallet-history normalization, notifications, usability
evaluation, deployment and final academic evidence. Chat and agentic features stay
optional. Do not sacrifice the core evaluation/report to implement every algorithm
listed in the literature survey.

## Report Evidence Register

For each experiment record dataset/source and permission, preprocessing, train/
validation/test dates, baseline, metrics, artifact/version, explanation checks and
limitations. Label synthetic data prominently. Freeze selection thresholds before
examining the final test set. Report negative results rather than replacing them
with successful synthetic examples.

See [decision-engine.md](decision-engine.md) for current behavior and test commands,
and [requirements-map.md](requirements-map.md) for PDF traceability.
