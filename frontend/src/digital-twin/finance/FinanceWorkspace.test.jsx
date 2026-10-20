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
import FinanceWorkspace from "./FinanceWorkspace";
import DigitalTwinPage from "../DigitalTwinPage";

const fixture = () => ({
  currency: "INR",
  summary: {
    cash: 20000,
    income: 50000,
    expense: 40000,
    monthly_surplus: 10000,
    savings_rate: 20,
    investments: 5000,
    debt: 1000,
    recorded_net_assets: 24000,
    cash_runway_months: 0.5,
    source: "manual_profile",
  },
  history: { months: 0, eligible: false },
  risk: {
    status: "needs_data",
    probability: null,
    reason:
      "Needs 24 recent complete months and both surplus and deficit examples.",
  },
  forecasts: Object.fromEntries(
    ["income", "expense"].map((field) => [
      field,
      {
        method: "profile_assumption",
        kind: "assumption",
        values: Array(12).fill(field === "income" ? 50000 : 40000),
        reason: "Using saved assumptions.",
      },
    ]),
  ),
  timeline: Array.from({ length: 12 }, (_, i) => ({
    month: `2027-${String(i + 1).padStart(2, "0")}`,
    income: 50000,
    expense: 40000,
    savings: 20000 + (i + 1) * 10000,
  })),
  debt_stress: {
    monthly_payment: null,
    payment_to_income_pct: null,
    reason: "Conditional calculation, not a default prediction.",
  },
  behaviour: {
    status: "needs_data",
    reason: "Needs 12 training months plus one completed month to inspect.",
  },
  categories: [],
  goals: [
    {
      id: "saved-1",
      title: "Synthetic goal",
      target: 90000,
      currency: "INR",
      progress_pct: 22.2,
      status: "projection",
      achievement_month: "2027-07",
      original_deadline: "2027-06-30",
    },
  ],
  warnings: ["Synthetic test data only."],
});
const props = () => ({
  userId: "a",
  token: "test-token",
  onBack: vi.fn(),
  onOpenProfile: vi.fn(),
  onOpenSimulations: vi.fn(),
  onSignIn: vi.fn(),
});
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
let payload, fetcher, status;
beforeEach(() => {
  payload = fixture();
  status = 200;
  fetcher = vi.fn(async (path) =>
    String(path).endsWith("/dashboard")
      ? response({
          profiles_present: {},
          goals: { financial: [] },
          decisions: [],
        })
      : response(payload, status),
  );
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const loaded = async () => {
  await screen.findByText("₹24,000", { exact: true });
};

describe("Financial workspace", () => {
  it("reviews Wallet totals before importing them and never treats preview as a saved scenario", async () => {
    render(<FinanceWorkspace {...props()} walletToken="synthetic-wallet" />);
    await loaded();
    fetcher.mockImplementation(async (path, options) => {
      if (String(path).endsWith("/wallet-history")) {
        expect(JSON.parse(options.body)).toEqual({
          wallet_token: "synthetic-wallet",
        });
        return response({
          currency: "INR",
          returned_months: 24,
          usable_months: 1,
          excluded_months: [],
          rows: [
            {
              month: "2026-09",
              income: 50000,
              expense: 40000,
              has_activity: true,
            },
          ],
          csv_text: "month,income,expense\n2026-09,50000,40000",
          source_name: "Reviewed Persona Wallet totals",
          note: "Confirm completeness.",
        });
      }
      return response(payload);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Review Wallet monthly history" }),
    );
    await screen.findByText(/Wallet returned 24 completed months/);
    expect(screen.getByLabelText("Monthly history CSV").value).toContain(
      "2026-09,50000,40000",
    );
    expect(screen.getByLabelText("History source").value).toBe(
      "Reviewed Persona Wallet totals",
    );
    expect(screen.getByRole("checkbox").checked).toBe(false);
    expect(
      fetcher.mock.calls.some(([path]) =>
        String(path).endsWith("decisions/history"),
      ),
    ).toBe(false);
    expect(screen.getByText("₹24,000", { exact: true })).toBeTruthy();
  });
  it("enters the full finance workspace from the Twin Finance control and returns", async () => {
    render(<DigitalTwinPage {...props()} name="Synthetic" />);
    await screen.findByText("Profile data loaded", { exact: true });
    fireEvent.click(
      screen.getByRole("button", { name: "Finance", exact: true }),
    );
    await loaded();
    expect(
      screen.getByRole("heading", { name: /Your financial twin/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "Financial Risk Prediction",
        exact: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "Spending Behaviour Analysis",
        exact: true,
      }),
    ).toBeTruthy();
    expect(
      fetcher.mock.calls.some(([path]) => path === "/users/a/twin/finance"),
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Back to Digital Twin" }),
    );
    expect(
      screen.getByRole("button", { name: "Finance", exact: true }),
    ).toBeTruthy();
  });
  it("shows actual values, honest model readiness and exact accessible forecast data", async () => {
    const callbacks = props();
    render(<FinanceWorkspace {...callbacks} />);
    await loaded();
    expect(screen.getByText("Not estimated", { exact: true })).toBeTruthy();
    expect(screen.getAllByText("Assumption", { exact: true })).toHaveLength(2);
    const nav = within(
      screen.getByRole("navigation", { name: "Financial analysis modules" }),
    );
    fireEvent.click(
      nav.getByRole("button", { name: "Income Forecasting", exact: true }),
    );
    expect(
      screen.queryByRole("heading", {
        name: "Expense Forecasting",
        exact: true,
      }),
    ).toBeNull();
    const card = screen
      .getByRole("heading", { name: "Income Forecasting", exact: true })
      .closest("section");
    fireEvent.click(within(card).getByText("Exact monthly values"));
    expect(within(card).getByRole("table").textContent).toContain("₹50,000");
    fireEvent.click(
      nav.getByRole("button", {
        name: "Financial Goal Prediction",
        exact: true,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open saved simulation" }),
    );
    expect(callbacks.onOpenSimulations).toHaveBeenCalledWith("saved-1");
    fireEvent.click(screen.getByRole("button", { name: "Profile & Wallet" }));
    expect(callbacks.onOpenProfile).toHaveBeenCalledOnce();
  });
  it("sends repayment scenarios only to the owned read-only analysis endpoint", async () => {
    render(<FinanceWorkspace {...props()} />);
    await loaded();
    fetcher.mockImplementation(async (path, options) => {
      if (String(path).endsWith("/analyze")) {
        expect(JSON.parse(options.body)).toEqual({
          monthly_debt_payment: 5000,
        });
        return response({
          ...payload,
          debt_stress: {
            monthly_payment: 5000,
            payment_to_income_pct: 10,
            stressed_payment_to_income_pct: 12.5,
          },
        });
      }
      return response(payload);
    });
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Monthly debt payment" }),
      { target: { value: "5000" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Calculate scenario" }));
    await screen.findByText("12.5%", { exact: true });
    const request = fetcher.mock.calls.find(([path]) =>
      String(path).endsWith("/analyze"),
    );
    expect(request[0]).toBe("/users/a/twin/finance/analyze");
    expect(request[1].headers.Authorization).toBe("Bearer test-token");
    expect(
      fetcher.mock.calls.some(([path]) => String(path).endsWith("financial/")),
    ).toBe(false);
  });
  it("imports complete monthly history with explicit source, currency and consent then refreshes", async () => {
    render(<FinanceWorkspace {...props()} />);
    await loaded();
    fireEvent.change(screen.getByLabelText("History source"), {
      target: { value: "Reviewed synthetic totals" },
    });
    fireEvent.change(screen.getByLabelText("Monthly history CSV"), {
      target: { value: "month,income,expense\n2026-09,50000,40000" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fetcher.mockImplementation(async (path, options) => {
      if (String(path).endsWith("decisions/history")) {
        expect(JSON.parse(options.body)).toEqual({
          csv_text: "month,income,expense\n2026-09,50000,40000",
          source_name: "Reviewed synthetic totals",
          currency: "INR",
          consent: true,
        });
        payload.history = {
          months: 1,
          eligible: true,
          source: "Reviewed synthetic totals",
          last_month: "2026-09",
        };
        return response({ id: "new-state" });
      }
      return response(payload);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Import & evaluate models" }),
    );
    await screen.findByText("1 complete history months");
    expect(screen.getByLabelText("Monthly history CSV").value).toBe("");
  });
  it("clears private values on expired authentication and supports recovery", async () => {
    const callbacks = props();
    render(<FinanceWorkspace {...callbacks} />);
    await loaded();
    fireEvent.change(screen.getByLabelText("Monthly history CSV"), {
      target: { value: "private unfinished records" },
    });
    status = 401;
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh financial analysis" }),
    );
    await screen.findByRole("alert");
    expect(screen.queryByText("₹24,000", { exact: true })).toBeNull();
    expect(screen.getByLabelText("Monthly history CSV").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(callbacks.onSignIn).toHaveBeenCalledOnce();
    status = 200;
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh financial analysis" }),
    );
    await loaded();
  });
  it("discards an old account's scenario response and clears entered financial records", async () => {
    let finish;
    const rendered = render(<FinanceWorkspace {...props()} />);
    await loaded();
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Monthly debt payment" }),
      { target: { value: "5000" } },
    );
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Calculate scenario" }));
    payload = {
      ...fixture(),
      summary: { cash: 123, source: "manual_profile" },
    };
    rendered.rerender(
      <FinanceWorkspace {...props()} userId="b" token="second" />,
    );
    await screen.findByText("₹123", { exact: true });
    await act(async () => finish(response(fixture())));
    expect(screen.queryByText("₹24,000", { exact: true })).toBeNull();
    expect(
      screen.getByRole("spinbutton", { name: "Monthly debt payment" }).value,
    ).toBe("");
  });
});
