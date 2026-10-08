import { defineConfig, devices } from "@playwright/test";

const port = 3100;

/**
 * Browser flows run against the production build: run `pnpm build` first.
 * Each spec sets its own viewport; Chromium is the only browser installed.
 */
export default defineConfig({
  testDir: "apps/web/e2e",
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    command: `pnpm --filter @weavetrail/web start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/evals`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
