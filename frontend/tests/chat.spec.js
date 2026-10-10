import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Requires a disposable backend pointed at backend/tests/ollama_fixture.py.
// This exercises the UI, API, storage and arithmetic, not live Qwen accuracy.
const backend = process.env.E2E_API_URL || "http://localhost:8000";
const test = base.extend({
  account: async ({ request }, use) => {
    const credentials = { email: "chat-test-" + randomUUID() + "@example.com", password: randomUUID() };
    const registration = await request.post(backend + "/auth/register", { data: { ...credentials, full_name: "Chat Test" } });
    expect(registration.ok()).toBeTruthy();
    const login = await request.post(backend + "/auth/login", { data: credentials });
    const { access_token: token } = await login.json();
    const headers = { Authorization: "Bearer " + token };
    const user = await (await request.get(backend + "/auth/me", { headers })).json();
    try {
      const profile = await request.post(backend + "/users/" + user.id + "/financial/", {
        headers, data: { monthly_income: 50000, monthly_expense: 30000, current_savings: 180000, investments: 0, debts: 0 },
      });
      expect(profile.ok()).toBeTruthy();
      await use({ user, token, headers });
    } finally {
      expect((await request.delete(backend + "/users/" + user.id, { headers })).status()).toBe(204);
    }
  },
});

async function enter(page, token) {
  await page.addInitScript(value => localStorage.setItem("pt_token", value), token);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Think it through with your twin." })).toBeVisible();
  await expect(page.getByLabel("Ask your twin")).toBeEnabled();
}

async function send(page, message) {
  await page.getByLabel("Ask your twin").fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByLabel("Ask your twin")).toBeEnabled();
}

async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
}

test("purchase conversation, explanations, loan, follow-up and saved reload", async ({ page, account }, testInfo) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await enter(page, account.token);
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath("chat-start.png"), fullPage: true });
  await send(page, "Can I afford a bike for 150000?");
  await expect(page.getByText(/What additional monthly running/)).toBeVisible();
  await expect(page.getByRole("table", { name: "Scenario results" })).toHaveCount(0);
  await send(page, "Monthly running cost 2000");
  const comparison = page.getByRole("table", { name: "Scenario results" }).last();
  await expect(comparison).toContainText("2,52,000");
  await expect(comparison.getByRole("row").filter({ hasText: "Buy after 3 months" })).toContainText("Preferred");
  await expect(page.getByText("Why this recommendation?", { exact: true })).toBeVisible();
  await page.getByText("What would change this recommendation?", { exact: true }).click();
  await expect(page.getByText(/Rerun minimum:/)).toBeVisible();
  await send(page, "Use a loan: down payment 30000, annual interest 10%, tenure 36 months.");
  await expect(page.getByRole("table", { name: "Scenario results" }).last()).toContainText("83,910.9");
  await send(page, "What if the cheaper bike costs 80000?");
  await expect(page.getByRole("table", { name: "Scenario results" }).last().getByRole("row").filter({ hasText: "Buy the cheaper alternative" })).toContainText("Preferred");
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath("chat-comparison.png"), fullPage: true });
  await page.locator(".chat-comparison").last().screenshot({ path: testInfo.outputPath("chat-final-options.png") });
  await page.reload();
  await expect(page.getByRole("table", { name: "Scenario results" })).toHaveCount(3);
  await expect(page.getByLabel("Currency", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await expect(page.getByRole("table", { name: "Scenario results" })).toHaveCount(0);
  await page.getByRole("complementary", { name: "Saved conversations" }).getByRole("button", { name: /Can I afford a bike/ }).click();
  await expect(page.getByRole("table", { name: "Scenario results" })).toHaveCount(3);
  await page.getByRole("button", { name: "Delete conversation", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("table", { name: "Scenario results" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("savings and job change use separate plans and retain a draft on model failure", async ({ page, account }, testInfo) => {
  await enter(page, account.token);
  await send(page, "Can I reach 300000 in savings within 12 months?");
  await expect(page.getByText(/How much could you reduce monthly spending/)).toBeVisible();
  await send(page, "Cut monthly spending by 2000");
  await expect(page.getByRole("table", { name: "Scenario results" })).toContainText("4,44,000");
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await send(page, "Should I switch to a job paying 60000 take-home per month?");
  await expect(page.getByText(/How many months would you be without income/)).toBeVisible();
  await send(page, "The unpaid gap is 2 months");
  await expect(page.getByText(/one-time relocation or transition cost/)).toBeVisible();
  await send(page, "Transition cost 10000");
  await expect(page.getByRole("table", { name: "Scenario results" })).toContainText("Preferred · conditional");
  await expect(page.getByRole("table", { name: "Scenario results" })).toContainText("5,30,000");
  await fits(page);
  await page.screenshot({ path: testInfo.outputPath("chat-career.png"), fullPage: true });
  await send(page, "Simulate a model outage");
  await expect(page.getByRole("alert")).toContainText("local model could not return");
  await expect(page.getByLabel("Ask your twin")).toHaveValue("Simulate a model outage");
  await expect(page.getByRole("table", { name: "Scenario results" })).toHaveCount(1);
});
