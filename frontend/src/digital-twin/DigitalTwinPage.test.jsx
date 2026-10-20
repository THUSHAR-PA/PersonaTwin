import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DigitalTwinPage from "./DigitalTwinPage";

// Explicit synthetic API fixtures. No test data is included in the production UI.
const summary = {
  id: "decision-1",
  title: "Test savings target",
  scenario: "savings_goal",
  currency: "INR",
  created_at: "2026-10-11T10:00:00Z",
  period_end: "2027-04-30",
  months: 6,
  target_amount: 90000,
  baseline_savings: 80000,
  alternative_savings: 92000,
  difference: 12000,
  goal_met: true,
};
const snapshot = () => ({
  schema_version: "1.0",
  refreshed_at: "2026-10-11T10:01:00Z",
  person: { full_name: "Synthetic Twin Test", career_goal: "Data engineering" },
  profiles_present: { financial: true, career: true, health: true },
  financial: {
    current_savings: 20000,
    monthly_income: 50000,
    monthly_expense: 40000,
    savings_rate: 20,
    currency: "INR",
    source: "manual_profile",
    balance_label: "Available savings",
    risk_classification: null,
  },
  career: {
    current_role: "Student",
    dream_role: "Data engineer",
    expected_salary: 600000,
    years_of_experience: 1,
    readiness: { value: 68, kind: "heuristic" },
  },
  skills: { existing: ["Python", "SQL"], gap: null, alignment: null },
  health: { height: 175, weight: 70, sleep_hours: 7.5, exercise_days: 0 },
  goals: { financial: [{ ...summary, progress_pct: 22.2 }] },
  decisions: [summary],
});
const decision = {
  id: summary.id,
  result: {
    currency: "INR",
    target_amount: 90000,
    trajectory: [
      {
        month: 1,
        period_end: "2026-11-30",
        baseline: 30000,
        alternative: 32000,
      },
      {
        month: 6,
        period_end: "2027-04-30",
        baseline: 80000,
        alternative: 92000,
      },
    ],
    contributions: [{ factor: "Spending reduction", amount: 12000 }],
    forecast: { method: "profile_assumption" },
    warnings: ["Saved inputs are fixed."],
    recommendations: [],
  },
};
const respond = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
let payload, status, fetcher;
const props = () => ({
  userId: "user-1",
  token: "synthetic-test-token",
  name: "Synthetic Twin Test",
  onOpenProfile: vi.fn(),
  onOpenSimulations: vi.fn(),
  onSignIn: vi.fn(),
});
const finance = () =>
  screen.getByRole("button", { name: "Open Financial twin", exact: true });
const refresh = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh digital twin", exact: true }),
  );
async function loaded() {
  await screen.findByText("Profile data loaded", { exact: true });
}

beforeEach(() => {
  payload = snapshot();
  status = 200;
  // jsdom intentionally has no GPU. These component tests exercise the WebGL fallback.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  fetcher = vi.fn(async (path) =>
    String(path).endsWith("/twin/dashboard")
      ? respond(payload, status)
      : respond(decision),
  );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Digital Twin data and interactions", () => {
  it("renders saved data, true zeros, provenance and usable panels without WebGL", async () => {
    const callbacks = props();
    render(<DigitalTwinPage {...callbacks} />);
    await loaded();
    expect(finance().textContent).toContain("₹20,000");
    expect(finance().textContent).toContain("20%");
    expect(
      screen.getByRole("button", { name: "Open Health twin" }).textContent,
    ).toContain("0 / 7");
    expect(screen.getByText("3D view unavailable")).toBeTruthy();
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer synthetic-test-token",
    );
    for (const label of [
      "Career",
      "Skills",
      "Goals",
      "Health",
      "All systems",
    ]) {
      const button = within(
        screen.getByRole("group", { name: "Twin views" }),
      ).getByRole("button", { name: label, exact: true });
      fireEvent.click(button);
      expect(button.getAttribute("aria-pressed")).toBe("true");
    }
    fireEvent.click(screen.getByRole("button", { name: "Open Skills twin" }));
    expect(screen.getByRole("dialog").textContent).toContain("Not available");
    fireEvent.click(
      screen.getByRole("button", { name: "Manage skills / GitHub sync" }),
    );
    expect(callbacks.onOpenProfile).toHaveBeenCalledWith("career");
  });

  it("compares saved outcomes, exposes the explanation and opens the exact existing simulation", async () => {
    const callbacks = props();
    render(<DigitalTwinPage {...callbacks} />);
    await loaded();
    fireEvent.click(
      screen.getByRole("button", { name: "Proposed change", exact: true }),
    );
    expect(document.querySelector(".dt-preview-result").textContent).toContain(
      "₹92,000",
    );
    expect(finance().textContent).toContain("₹20,000");
    fireEvent.click(
      screen.getByRole("button", { name: "See why", exact: true }),
    );
    await screen.findByText("Why the outcome changes", { exact: true });
    expect(screen.getByRole("dialog").textContent).toContain(
      "Spending reduction",
    );
    expect(screen.getByRole("dialog").textContent).toContain("₹12,000");
    fireEvent.click(
      screen.getByRole("button", { name: "Open full simulation" }),
    );
    expect(callbacks.onOpenSimulations).toHaveBeenCalledWith("decision-1");
  });

  it("refreshes current data without changing saved projections", async () => {
    render(<DigitalTwinPage {...props()} />);
    await loaded();
    payload.financial.current_savings = 45000;
    payload.goals.financial[0].progress_pct = 50;
    refresh();
    await waitFor(() => expect(finance().textContent).toContain("₹45,000"));
    expect(
      screen.getByRole("button", { name: "Open Goals twin" }).textContent,
    ).toContain("50%");
    expect(document.querySelector(".dt-preview-result").textContent).toContain(
      "₹80,000",
    );
  });

  it("keeps the dated last view on network failure, then recovers", async () => {
    render(<DigitalTwinPage {...props()} />);
    await loaded();
    status = 503;
    refresh();
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "Showing data read",
    );
    expect(finance().textContent).toContain("₹20,000");
    status = 200;
    refresh();
    await loaded();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears financial and decision values after authentication expires", async () => {
    const callbacks = props();
    render(<DigitalTwinPage {...callbacks} />);
    await loaded();
    status = 401;
    refresh();
    await screen.findByRole("alert");
    expect(finance().textContent).not.toContain("₹20,000");
    expect(screen.queryByLabelText("Explore a saved decision")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(callbacks.onSignIn).toHaveBeenCalledOnce();
  });

  it("never substitutes zero balances or made-up scores for missing profiles", async () => {
    payload = {
      person: { full_name: "Empty test" },
      profiles_present: {},
      financial: null,
      career: null,
      health: null,
      skills: { existing: [] },
      goals: { financial: [] },
      decisions: [],
    };
    render(<DigitalTwinPage {...props()} />);
    await loaded();
    expect(finance().textContent).toContain("Not available");
    expect(finance().textContent).not.toContain("₹0");
    expect(
      screen.getByRole("button", { name: "Open Career twin" }).textContent,
    ).not.toContain("0%");
  });

  it("does not label unconfirmed or mixed-currency amounts as INR", async () => {
    payload.financial.currency = null;
    render(<DigitalTwinPage {...props()} />);
    await loaded();
    expect(finance().textContent).toContain("Currency unconfirmed");
    expect(finance().textContent).not.toContain("₹");
    payload.financial.mixed_currency = true;
    payload.financial.currency = "INR";
    refresh();
    await waitFor(() =>
      expect(finance().textContent).toContain("Mixed currencies"),
    );
    expect(finance().textContent).not.toContain("₹20,000");
  });

  it("discards an in-flight response after switching accounts", async () => {
    let resolveOld;
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const rendered = render(<DigitalTwinPage key="a" {...props()} />);
    expect(finance().textContent).toContain("Loading your data");
    const oldPayload = snapshot();
    payload.person.full_name = "Second synthetic user";
    payload.financial.current_savings = 800;
    rendered.rerender(
      <DigitalTwinPage
        key="b"
        {...props()}
        userId="user-2"
        token="second-test-token"
      />,
    );
    await loaded();
    await act(async () => {
      resolveOld(respond(oldPayload));
    });
    expect(finance().textContent).toContain("₹800");
    expect(finance().textContent).not.toContain("₹20,000");
  });

  it("polls only while visible and stops after unmount", async () => {
    vi.useFakeTimers();
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    const rendered = render(<DigitalTwinPage {...props()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const initialCount = fetcher.mock.calls.length;
    visibility.mockReturnValue("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(fetcher.mock.calls.length).toBe(initialCount);
    visibility.mockReturnValue("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetcher.mock.calls.length).toBe(initialCount + 1);
    rendered.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(fetcher.mock.calls.length).toBe(initialCount + 1);
  });
});
