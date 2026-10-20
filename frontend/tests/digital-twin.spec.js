import { test as base, expect } from "@playwright/test";
import { randomUUID, createHash } from "node:crypto";

const backend = process.env.E2E_API_URL || "http://localhost:8000";
const test = base.extend({
  twinAccount: async ({ request }, use) => {
    const email = `twin-${randomUUID()}@example.com`,
      password = randomUUID();
    expect(
      (
        await request.post(`${backend}/auth/register`, {
          data: { email, password, full_name: "Synthetic Twin Test" },
        })
      ).ok(),
    ).toBeTruthy();
    const login = await request.post(`${backend}/auth/login`, {
      data: { email, password },
    });
    const { access_token: token } = await login.json();
    const headers = { Authorization: `Bearer ${token}` };
    const user = await (
      await request.get(`${backend}/auth/me`, { headers })
    ).json();
    const url = `${backend}/users/${user.id}`;
    try {
      await use({ user, token, headers, url });
    } finally {
      expect((await request.delete(url, { headers })).status()).toBe(204);
    }
  },
});

async function seed(request, account) {
  const { headers, url } = account;
  for (const [path, data] of [
    [
      "financial",
      {
        monthly_income: 50000,
        monthly_expense: 40000,
        current_savings: 20000,
        investments: 5000,
        debts: 0,
      },
    ],
    [
      "career",
      {
        current_role: "Engineering student",
        years_of_experience: 1,
        expected_salary: 600000,
        dream_role: "Data engineer",
        skills: ["Python", "SQL", "React", "TensorFlow", "Pandas"],
        certifications: [],
      },
    ],
    ["health", { height: 175, weight: 70, sleep_hours: 7.5, exercise_days: 4 }],
  ])
    expect(
      (await request.post(`${url}/${path}/`, { headers, data })).ok(),
    ).toBeTruthy();
  await request.put(url, {
    headers,
    data: {
      career_goal: "Build reliable data platforms",
      dream_country: "India",
    },
  });
  const state = await (
    await request.post(`${url}/decisions/states`, {
      headers,
      data: { currency: "INR" },
    })
  ).json();
  const result = await request.post(`${url}/decisions/`, {
    headers,
    data: {
      state_id: state.id,
      title: "Six-month learning fund",
      target_amount: 90000,
      months: 6,
      monthly_reduction: 2000,
      forecast: "profile",
    },
  });
  expect(result.ok()).toBeTruthy();
  return result.json();
}

async function openTwin(page, account) {
  await page.addInitScript(
    (token) => localStorage.setItem("pt_token", token),
    account.token,
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Digital Twin", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Digital Twin.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Profile data loaded", { exact: true }),
  ).toBeVisible();
}

async function fits(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  const clipped = await page
    .locator(".digital-twin button:visible")
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) =>
            element.scrollWidth > element.clientWidth + 2 ||
            element.scrollHeight > element.clientHeight + 2,
        )
        .map(
          (element) =>
            element.getAttribute("aria-label") || element.textContent.trim(),
        ),
    );
  expect(clipped).toEqual([]);
}

test("real profiles, saved decision explanations, live refresh and existing navigation", async ({
  page,
  request,
  twinAccount,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const saved = await seed(request, twinAccount);
  await openTwin(page, twinAccount);
  const finance = page.getByRole("button", {
    name: "Open Financial twin",
    exact: true,
  });
  await expect(finance).toContainText("₹20,000");
  await expect(finance).toContainText("20%");
  await expect(
    page.getByRole("button", { name: "Open Skills twin", exact: true }),
  ).toContainText("Python");
  await expect(
    page.getByRole("button", { name: "Open Health twin", exact: true }),
  ).toContainText("7.5");
  await expect(page.getByTestId("hologram")).toHaveAttribute(
    "data-render-state",
    /ready|fallback/,
  );
  await fits(page);
  await page.screenshot({
    path: testInfo.outputPath("digital-twin.png"),
    fullPage: true,
  });

  for (const view of ["Career", "Skills", "Goals", "Health", "All systems"]) {
    const button = page
      .getByRole("group", { name: "Twin views" })
      .getByRole("button", { name: view, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  await finance.click();
  await expect(
    page.getByRole("heading", { name: /Your financial twin/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Financial Risk Prediction",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Income Forecasting", exact: true }),
  ).toBeVisible();
  await fits(page);
  await page.screenshot({
    path: testInfo.outputPath("financial-workspace.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to Digital Twin" }).click();
  const dialog = page.getByRole("dialog");

  await request.put(`${twinAccount.url}/financial/`, {
    headers: twinAccount.headers,
    data: { current_savings: 45000 },
  });
  await page
    .getByRole("button", { name: "Refresh digital twin", exact: true })
    .click();
  await expect(finance).toContainText("₹45,000");
  await expect(
    page.getByRole("button", { name: "Open Goals twin", exact: true }),
  ).toContainText("50%");
  await page
    .getByRole("button", { name: "Proposed change", exact: true })
    .click();
  await expect(page.locator(".dt-preview-result")).toContainText("₹92,000");
  await page.getByRole("button", { name: "See why", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Why the outcome changes" }),
  ).toBeVisible();
  await expect(dialog).toContainText("Spending reduction");
  await expect(dialog).toContainText("₹12,000");
  await dialog.getByText("Exact monthly values", { exact: true }).click();
  await expect(dialog.getByRole("table")).toContainText("₹92,000");
  await page.screenshot({
    path: testInfo.outputPath("saved-explanation.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Open full simulation" }).click();
  await expect(
    page.getByRole("heading", { name: saved.title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Digital Twin", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Skills twin", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage skills / GitHub sync", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sync GitHub", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Digital Twin", exact: true }).click();
  if (testInfo.project.name === "desktop") {
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await fits(page);
      await page.screenshot({
        path: testInfo.outputPath(`twin-${width}.png`),
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});

test("finance drill-down imports confirmed history, evaluates models and keeps scenarios read-only", async ({
  page,
  request,
  twinAccount,
}, testInfo) => {
  await seed(request, twinAccount);
  await openTwin(page, twinAccount);
  await page.getByRole("button", { name: "Finance", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Your financial twin/ }),
  ).toBeVisible();
  const now = new Date();
  const monthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const rows = Array.from({ length: 60 }, (_, i) => {
    const index = monthIndex - 60 + i;
    const month = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
    return `${month},50000,${(50000 + 15000 * Math.sin(i * 0.45)).toFixed(2)}`;
  });
  await page
    .getByLabel("History source", { exact: true })
    .fill("Synthetic browser-test totals");
  await page
    .getByLabel("Monthly history CSV", { exact: true })
    .fill(`month,income,expense\n${rows.join("\n")}`);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Import & evaluate models", exact: true })
    .click();
  await expect(
    page.getByText("60 complete history months", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Logistic regression", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Isolation Forest · unsupervised", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("spinbutton", { name: "Monthly debt payment", exact: true })
    .fill("5000");
  await page
    .getByRole("button", { name: "Calculate scenario", exact: true })
    .click();
  await expect(page.getByText("12.5%", { exact: true })).toBeVisible();
  const profile = await (
    await request.get(`${twinAccount.url}/financial/`, {
      headers: twinAccount.headers,
    })
  ).json();
  expect(profile.monthly_expense).toBe(40000);
  expect(profile.debts).toBe(0);
  const nav = page.getByRole("navigation", {
    name: "Financial analysis modules",
  });
  for (const name of [
    "Financial Risk Prediction",
    "Expense Forecasting",
    "Income Forecasting",
    "Debt Stress Prediction",
    "Financial Goal Prediction",
    "Spending Behaviour Analysis",
  ]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await nav.getByRole("button", { name: "All insights", exact: true }).click();
  if (testInfo.project.name === "desktop") {
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await fits(page);
      await page.screenshot({
        path: testInfo.outputPath(`finance-${width}.png`),
        fullPage: true,
      });
    }
  } else await fits(page);
});

test("actual WebGL render, mouse rotation, keyboard zoom and reduced motion", async ({
  page,
  request,
  twinAccount,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "GPU rendering and mouse input are checked on desktop; mobile covers data and touch-sized controls.",
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /THREE|shader|WebGL/i.test(message.text())
    )
      errors.push(message.text());
  });
  await seed(request, twinAccount);
  await openTwin(page, twinAccount);
  const scene = page.getByTestId("hologram"),
    canvas = scene.locator("canvas");
  await expect(scene).toHaveAttribute("data-render-state", "ready");
  await expect(scene).toHaveAttribute("data-motion", "paused");
  const digest = async () =>
    createHash("sha256")
      .update(await canvas.screenshot())
      .digest("hex");
  const initial = await digest();
  await page.getByRole("button", { name: "Rotate right", exact: true }).click();
  await expect.poll(digest).not.toBe(initial);
  const rotated = await digest();
  await scene.focus();
  await page.keyboard.press("+");
  await expect.poll(digest).not.toBe(rotated);
  const zoomed = await digest();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 65,
    box.y + box.height / 2 + 15,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect.poll(digest).not.toBe(zoomed);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("hologram-webgl.png"),
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(scene).toHaveAttribute("data-motion", "active");
  await page
    .getByRole("button", { name: "Pause animation", exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-motion", "paused");
  // Context loss must preserve readable data and expose recovery.
  await canvas.evaluate((element) =>
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(scene).toHaveAttribute("data-render-state", "fallback");
  await expect(
    page.getByRole("button", { name: "Open Financial twin" }),
  ).toContainText("₹20,000");
  expect(errors).toEqual([]);
});

test("empty profiles and unsupported WebGL retain accessible data panels", async ({
  page,
  twinAccount,
}, testInfo) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return /webgl/i.test(kind) ? null : original.call(this, kind, ...args);
    };
  });
  await openTwin(page, twinAccount);
  await expect(
    page.getByText("3D view unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Financial twin" }),
  ).toContainText("Not available");
  await expect(
    page.getByRole("button", { name: "Open Financial twin" }),
  ).not.toContainText("₹0");
  await expect(
    page.getByText("0 / 3 profiles saved", { exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Open Career twin" }).click();
  await expect(page.getByRole("dialog")).toContainText("Not available");
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await fits(page);
  await page.screenshot({
    path: testInfo.outputPath("empty-fallback.png"),
    fullPage: true,
  });
});

test("failed refresh retains dated data; expired sessions clear private values", async ({
  page,
  request,
  twinAccount,
}) => {
  await seed(request, twinAccount);
  await openTwin(page, twinAccount);
  await page.route("**/twin/dashboard", (route) =>
    route.fulfill({ status: 503, json: { detail: "Synthetic outage" } }),
  );
  await page
    .getByRole("button", { name: "Refresh digital twin", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Showing data read");
  await expect(
    page.getByRole("button", { name: "Open Financial twin" }),
  ).toContainText("₹20,000");
  await page.unroute("**/twin/dashboard");
  await page.route("**/twin/dashboard", (route) =>
    route.fulfill({ status: 401, json: { detail: "Expired" } }),
  );
  await page
    .getByRole("button", { name: "Refresh digital twin", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("session has expired");
  await expect(
    page.getByRole("button", { name: "Open Financial twin" }),
  ).not.toContainText("₹20,000");
  await page
    .getByRole("button", { name: "Sign in again", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
});
