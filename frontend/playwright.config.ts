import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174",
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: process.env.E2E_SKIP_WEB_SERVER === "true" ? undefined : {
    command: "npm.cmd run dev",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
    timeout: 60_000
  }
});
