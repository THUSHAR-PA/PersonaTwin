import { request } from "@playwright/test";

export default async function checkServers(config) {
  const client = await request.newContext({ timeout: 5000 });
  const frontend = config.projects[0].use.baseURL;
  const backend = process.env.E2E_API_URL || "http://localhost:8000";
  try {
    try {
      const response = await client.get(`${backend}/healthz`);
      if (!response.ok() || (await response.json()).status !== "ok") throw new Error("Unexpected health response");
    } catch {
      throw new Error(`Backend is unavailable at ${backend}. Start FastAPI on port 8000 (or set E2E_API_URL) before running browser tests.`);
    }
    try {
      const response = await client.get(frontend);
      if (!response.ok() || !(await response.text()).includes('/src/main.jsx')) throw new Error("PersonaTwin HTML was not returned");
    } catch {
      throw new Error(`PersonaTwin frontend is unavailable at ${frontend}. For a fresh test server, run: env -u E2E_EXTERNAL_SERVER -u E2E_BASE_URL npx playwright test. External-server mode requires a responsive Vite server.`);
    }
  } finally {
    await client.dispose();
  }
}
