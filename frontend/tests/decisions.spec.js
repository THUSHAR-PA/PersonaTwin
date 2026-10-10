import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const backend = process.env.E2E_API_URL || "http://localhost:8000";
const test = base.extend({
  account: async ({ request }, use) => {
    const email = `decision-test-${randomUUID()}@example.com`, password = randomUUID();
    const registered = await request.post(`${backend}/auth/register`, { data: { email, password, full_name: "Decision Test" } });
    expect(registered.ok()).toBeTruthy();
    const login = await request.post(`${backend}/auth/login`, { data: { email, password } });
    const { access_token: token } = await login.json();
    const headers = { Authorization: `Bearer ${token}` };
    const me = await request.get(`${backend}/auth/me`, { headers });
    const user = await me.json();
    try {
      const saved = await request.post(`${backend}/users/${user.id}/financial/`, { headers, data: { monthly_income: 50000, monthly_expense: 40000, current_savings: 20000, investments: 0, debts: 0 } });
      expect(saved.ok()).toBeTruthy();
      await use({ user, token, headers });
    } finally {
      const removed = await request.delete(`${backend}/users/${user.id}`, { headers });
      expect(removed.status()).toBe(204);
    }
  },
});

async function expectLayoutFits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const clipped = await page.locator("button:visible").evaluateAll(buttons => buttons
    .filter(button => button.scrollWidth > button.clientWidth + 2 || button.scrollHeight > button.clientHeight + 2)
    .map(button => button.textContent.trim()));
  expect(clipped).toEqual([]);
}

test("login and registration layouts", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expectLayoutFits(page);
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expectLayoutFits(page);
  await page.screenshot({ path: testInfo.outputPath("register.png"), fullPage: true });
});

test("shared layouts across overview, profiles, dialogs and simulations", async ({ page, account }, testInfo) => {
  await page.addInitScript(token => localStorage.setItem("pt_token", token), account.token);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Digital Twin Summary" })).toBeVisible();
  await expectLayoutFits(page);
  await page.screenshot({ path: testInfo.outputPath("overview.png"), fullPage: true });
  await page.getByRole("button", { name: "Profiles", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save identity" })).toBeVisible();
  await expectLayoutFits(page);
  await page.screenshot({ path: testInfo.outputPath("identity-edit.png"), fullPage: true });
  for (const domain of ["Financial", "Career", "Health"]) {
    await page.getByRole("button", { name: domain, exact: true }).click();
    await expectLayoutFits(page);
    await page.screenshot({ path: testInfo.outputPath(`${domain.toLowerCase()}-profile.png`), fullPage: true });
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expectLayoutFits(page);
    await page.screenshot({ path: testInfo.outputPath(`${domain.toLowerCase()}-edit.png`), fullPage: true });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.getByRole("button", { name: "Financial", exact: true }).click();
  await page.getByRole("button", { name: "Sync wallet", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectLayoutFits(page);
  await page.screenshot({ path: testInfo.outputPath("wallet-dialog.png"), fullPage: true });
  await page.getByRole("button", { name: "Close wallet login" }).click();
  await page.getByRole("button", { name: "Simulations", exact: true }).click();
  await page.getByRole("tab", { name: "Calculators", exact: true }).click();
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.locator(".result-heading")).toBeVisible();
  await expectLayoutFits(page);
  await page.screenshot({ path: testInfo.outputPath("simulation.png"), fullPage: true });
  // Additional breakpoints catch narrow-phone and tablet grid regressions.
  if (testInfo.project.name === "desktop") {
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const view of ["Overview", "Profiles", "Simulations"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        await expectLayoutFits(page);
        await page.screenshot({ path: testInfo.outputPath(`${view.toLowerCase()}-${width}.png`), fullPage: true });
      }
    }
  }
});

test("compare, explain, save feedback, reload and retain the original decision", async ({ page, account }, testInfo) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(token => localStorage.setItem("pt_token", token), account.token);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Simulations", exact: true }).click();
  await page.getByLabel("Simulation name").fill("Six-month savings comparison");
  await page.getByLabel("Savings target").fill("90000");
  await page.getByLabel("Projection months").fill("6");
  await page.getByLabel("Monthly spending reduction").fill("2000");
  await page.getByText("Data and forecast settings", { exact: true }).click();
  await page.getByLabel("Expense forecast").selectOption("profile");
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByRole("heading", { name: "Six-month savings comparison" })).toBeVisible();
  await expect(page.locator(".decision-totals")).toContainText("80,000");
  await expect(page.locator(".decision-totals")).toContainText("92,000");
  await expect(page.getByRole("table", { name: "Observed savings summary" })).toContainText("Not available");
  await page.getByText("Record an observed outcome", { exact: true }).click();
  await expect(page.getByText("No completed projection months yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save outcome", exact: true })).toHaveCount(0);
  const canvas = page.locator(".decision-chart canvas");
  expect(await canvas.evaluate(element => {
    const { data } = element.getContext("2d").getImageData(0, 0, element.width, element.height);
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
    return count;
  })).toBeGreaterThan(100);
  await page.getByRole("combobox", { name: "Response", exact: true }).selectOption("accepted");
  await page.getByLabel("Note", { exact: true }).fill("Review essential expenses first.");
  await page.getByRole("button", { name: "Save feedback" }).click();
  await expect(page.locator(".decision-events")).toContainText("accepted");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("decision.png"), fullPage: true });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Simulations", exact: true }).click();
  await page.getByRole("tab", { name: "Saved simulations" }).click();
  await page.getByRole("button", { name: "Six-month savings comparison" }).click();
  await expect(page.locator(".decision-events")).toContainText("Review essential expenses first.");
  expect(errors).toEqual([]);
});

test("completed-month outcome corrections (historical UI fixture)", async ({ page, account }, testInfo) => {
  let fixture;
  await page.route("**/decisions/", async route => {
    const response = await route.fetch();
    if (route.request().method() !== "POST") return route.fulfill({ response });
    fixture = await response.json();
    fixture.result.trajectory[0].period_end = "2024-01-31";
    await route.fulfill({ response, json: fixture });
  });
  await page.route("**/decisions/*/outcomes", async route => {
    const payload = route.request().postDataJSON();
    expect(payload.month).toBe(1);
    expect(payload.observed_on).toBe("2024-01-31");
    const predicted = fixture.result.trajectory[0][payload.branch];
    const error = payload.savings - predicted;
    fixture.outcome_evaluation.branches[payload.branch] = {
      count: 1, mae: Math.abs(error), rmse: Math.abs(error), mean_error: error,
      observations: [{ month: 1, period_end: payload.observed_on, actual_savings: payload.savings, projected_savings: predicted, error }],
    };
    await route.fulfill({ status: 201, json: fixture });
  });
  await page.addInitScript(token => localStorage.setItem("pt_token", token), account.token);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Simulations", exact: true }).click();
  await page.getByRole("button", { name: "Run simulation" }).click();
  await page.getByText("Record an observed outcome", { exact: true }).click();
  const period = page.getByRole("combobox", { name: "Completed period", exact: true });
  await expect(period.locator("option")).toHaveCount(1);
  await page.getByLabel("Actual savings", { exact: true }).fill("31000");
  await page.getByLabel("Outcome note").fill("Historical test observation");
  await page.getByRole("button", { name: "Save outcome", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save correction" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Observed savings summary" })).toContainText("1,000");
  await page.getByLabel("Actual savings", { exact: true }).fill("30000");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByRole("table", { name: "Observed savings summary" })).not.toContainText("1,000");
  await page.getByText("Alternative observations", { exact: true }).click();
  await expect(page.getByRole("table", { name: "alternative observed months" })).toContainText("30,000");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("outcomes.png"), fullPage: true });
});

test("career assumptions and invalid spending reduction", async ({ page, account }) => {
  await page.addInitScript(token => localStorage.setItem("pt_token", token), account.token);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Simulations", exact: true }).click();
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("job_switch");
  await page.getByLabel("Projection months").fill("6");
  await page.getByLabel("New monthly take-home income").fill("60000");
  await page.getByLabel("One-time transition / tuition cost").fill("10000");
  await page.getByLabel("Months without income").fill("2");
  await page.getByLabel("Monthly spending reduction").fill("50000");
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByRole("alert")).toContainText("cannot exceed");
  await page.getByLabel("Monthly spending reduction").fill("2000");
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.locator(".decision-totals")).toContainText("22,000");
});

test("simulation entry shows saved finances and offers profile setup when missing", async ({ page, account, request }) => {
  await page.addInitScript(token => localStorage.setItem("pt_token", token), account.token);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tab", { name: "New simulation", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Decisions", exact: true })).toHaveCount(0);
  const finances = page.getByRole("region", { name: "Starting finances" });
  await expect(finances).toContainText("50,000");
  await expect(finances).toContainText("40,000");
  await expect(finances).toContainText("20,000");
  await expect(page.getByLabel("Expense forecast")).toBeHidden();
  const removed = await request.delete(`${backend}/users/${account.user.id}/financial/`, { headers: account.headers });
  expect(removed.status()).toBe(204);
  await page.getByRole("button", { name: "Refresh simulations" }).click();
  await expect(page.getByText("Financial profile required.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run simulation", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Add financial profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Financial Profile", exact: true })).toBeVisible();
});
