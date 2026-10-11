import { defineConfig, devices } from "@playwright/test";

const externalServer = process.env.E2E_EXTERNAL_SERVER === "1";
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
if (!externalServer && new URL(baseURL).origin !== "http://127.0.0.1:5174") {
  throw new Error("Use E2E_EXTERNAL_SERVER=1 for a custom E2E_BASE_URL, or unset both variables to start the test server on port 5174.");
}

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/check-servers.js",
  timeout: 60000,
  fullyParallel: false,
  use: {
    baseURL, reducedMotion: "reduce", navigationTimeout: 15000,
    trace: "retain-on-failure", screenshot: "only-on-failure",
    ...(process.env.E2E_CHROMIUM_EXECUTABLE ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_EXECUTABLE } } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  ...(!externalServer ? { webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort", url: baseURL, reuseExistingServer: false, timeout: 30000 } } : {}),
});
