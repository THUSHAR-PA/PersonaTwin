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
  person: { full_name: "Demo persona", career_goal: "Grow into data engineering", dream_country: null },
  profiles_present: { financial: true, career: true, health: true },
  financial: {
    current_savings: 120000, monthly_income: 85000, monthly_expense: 55000,
    investments: 45000, debts: 0, savings_rate: 35.3, currency: "INR",
    source: "manual_profile", balance_label: "Available savings", mixed_currency: false,
    savings_rate_basis: "Demo calculation: (85,000 − 55,000) / 85,000 × 100.",
    risk_classification: null,
    risk_note: "Demo values only. A financial risk model is not connected.",
  },
  career: {
    current_role: "Software developer", dream_role: "Data engineer",
    expected_salary: null, years_of_experience: 2,
    readiness: { value: null, kind: "heuristic", basis: "Unavailable in this demo." },
    prediction_note: "This preview has no connected career model or personal account.",
  },
  skills: { existing: ["Python", "React", "SQL", "Git"], gap: null, alignment: null },
  health: { height: 175, weight: 70, sleep_hours: 7.5, exercise_days: 3 },
  goals: {
    financial: [{ ...summary, progress_pct: 33.3, progress_basis: "Demo savings divided by demo target; no funds are allocated." }],
    career: "Grow into data engineering",
  },
  decisions: [summary],
};
const empty = {
  schema_version: "1.0", person: { full_name: "Empty demo persona" },
  profiles_present: { financial: false, career: false, health: false },
  financial: null, career: null, skills: { existing: [] }, health: null,
  goals: { financial: [] }, decisions: [],
};
const detail = {
  id: summary.id,
  result: {
    currency: "INR", target_amount: 360000,
    trajectory: Array.from({ length: 6 }, (_, index) => ({
      month: index + 1,
      period_end: ["2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"][index],
      baseline: 120000 + (index + 1) * 30000,
      alternative: 120000 + (index + 1) * 40000,
    })),
    contributions: [{ factor: "Demo spending reduction: ₹10,000 × 6 months", amount: 60000 }],
    forecast: { method: "profile_assumption" },
    warnings: ["Synthetic demonstration only. This is not your data or a personal financial forecast."],
    recommendations: [],
  },
};

export function useTwinDashboard() {
  const showEmpty = useContext(DemoContext);
  const [refreshedAt, setRefreshedAt] = useState(() => new Date().toISOString());
  return {
    data: { ...(showEmpty ? empty : sample), refreshed_at: refreshedAt },
    loading: false, error: null,
    refresh: () => setRefreshedAt(new Date().toISOString()),
  };
}
export function useDecisionDetail() {
  return { data: detail, error: null, retry: () => {} };
}
