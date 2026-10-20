import { createContext, useContext, useState } from "react";

// Synthetic fixtures for the separately built, visibly labeled preview.
// This module is never imported by the authenticated application.
export const DemoContext = createContext(false);
const summary = {
  id: "demo-savings",
  title: "Demo · build an emergency fund",
  scenario: "savings_goal",
  currency: "INR",
  created_at: "2026-10-12T00:00:00Z",
  period_end: "2027-04-30",
  months: 6,
  target_amount: 360000,
  baseline_savings: 300000,
  alternative_savings: 360000,
  difference: 60000,
  goal_met: true,
  kind: "saved_projection",
};
const sample = {
  schema_version: "1.0",
  person: {
    full_name: "Demo persona",
    career_goal: "Grow into data engineering",
    dream_country: null,
  },
  profiles_present: { financial: true, career: true, health: true },
  financial: {
    current_savings: 120000,
    monthly_income: 85000,
    monthly_expense: 55000,
    investments: 45000,
    debts: 0,
    savings_rate: 35.3,
    currency: "INR",
    source: "manual_profile",
    balance_label: "Available savings",
    mixed_currency: false,
    savings_rate_basis: "Demo calculation: (85,000 − 55,000) / 85,000 × 100.",
    risk_classification: null,
    risk_note: "Demo values only. A financial risk model is not connected.",
  },
  career: {
    current_role: "Software developer",
    dream_role: "Data engineer",
    expected_salary: null,
    years_of_experience: 2,
    readiness: {
      value: null,
      kind: "heuristic",
      basis: "Unavailable in this demo.",
    },
    prediction_note:
      "This preview has no connected career model or personal account.",
  },
  skills: {
    existing: ["Python", "React", "SQL", "Git"],
    gap: null,
    alignment: null,
  },
  health: { height: 175, weight: 70, sleep_hours: 7.5, exercise_days: 3 },
  goals: {
    financial: [
      {
        ...summary,
        progress_pct: 33.3,
        progress_basis:
          "Demo savings divided by demo target; no funds are allocated.",
      },
    ],
    career: "Grow into data engineering",
  },
  decisions: [summary],
};
const empty = {
  schema_version: "1.0",
  person: { full_name: "Empty demo persona" },
  profiles_present: { financial: false, career: false, health: false },
  financial: null,
  career: null,
  skills: { existing: [] },
  health: null,
  goals: { financial: [] },
  decisions: [],
};
const detail = {
  id: summary.id,
  result: {
    currency: "INR",
    target_amount: 360000,
    trajectory: Array.from({ length: 6 }, (_, index) => ({
      month: index + 1,
      period_end: [
        "2026-11-30",
        "2026-12-31",
        "2027-01-31",
        "2027-02-28",
        "2027-03-31",
        "2027-04-30",
      ][index],
      baseline: 120000 + (index + 1) * 30000,
      alternative: 120000 + (index + 1) * 40000,
    })),
    contributions: [
      { factor: "Demo spending reduction: ₹10,000 × 6 months", amount: 60000 },
    ],
    forecast: { method: "profile_assumption" },
    warnings: [
      "Synthetic demonstration only. This is not your data or a personal financial forecast.",
    ],
    recommendations: [],
  },
};

export function useTwinDashboard() {
  const showEmpty = useContext(DemoContext);
  const [refreshedAt, setRefreshedAt] = useState(() =>
    new Date().toISOString(),
  );
  return {
    data: { ...(showEmpty ? empty : sample), refreshed_at: refreshedAt },
    loading: false,
    error: null,
    refresh: () => setRefreshedAt(new Date().toISOString()),
  };
}
export function useDecisionDetail() {
  return { data: detail, error: null, retry: () => {} };
}

// The isolated preview also supports the finance drill-down without contacting an API.
export function useTwinResource() {
  const showEmpty = useContext(DemoContext);
  const [revision, setRevision] = useState(0);
  const finance = showEmpty ? {} : sample.financial;
  const timeline = showEmpty
    ? []
    : Array.from({ length: 12 }, (_, index) => ({
        month: new Date(Date.UTC(2026, 10 + index, 1))
          .toISOString()
          .slice(0, 7),
        income: 85000,
        expense: 55000,
        savings: 120000 + (index + 1) * 30000,
      }));
  const unavailable = {
    status: "needs_data",
    probability: null,
    reason:
      "This fictional preview has no training history. Import real, confirmed monthly history in the full application to evaluate models.",
  };
  return {
    data: {
      demo: true,
      currency: "INR",
      summary: {
        income: finance.monthly_income,
        expense: finance.monthly_expense,
        cash: finance.current_savings,
        investments: finance.investments,
        debt: finance.debts,
        monthly_surplus: showEmpty ? null : 30000,
        savings_rate: finance.savings_rate,
        recorded_net_assets: showEmpty ? null : 165000,
        cash_runway_months: showEmpty ? null : 2.2,
        source: "manual_profile",
      },
      history: { months: 0, eligible: false },
      risk: unavailable,
      behaviour: unavailable,
      forecasts: showEmpty
        ? {}
        : Object.fromEntries(
            ["income", "expense"].map((field) => [
              field,
              {
                method: "profile_assumption",
                kind: "assumption",
                values: Array(12).fill(field === "income" ? 85000 : 55000),
                reason:
                  "Fictional demo assumption; no ML model was trained on this profile.",
              },
            ]),
          ),
      timeline,
      debt_stress: {
        monthly_payment: showEmpty ? null : 0,
        reason:
          "Demo only. Repayment scenarios and data imports require the connected application.",
      },
      categories: [],
      goals: [],
      warnings: [
        "Fictional preview. These are not your finances or validated model outputs.",
      ],
      models: { version: "demo" },
    },
    loading: false,
    error: null,
    refresh: () => setRevision(revision + 1),
  };
}
