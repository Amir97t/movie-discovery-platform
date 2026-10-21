import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node tests/start-servers.mjs",
    env: {
      ...process.env,
      MOVIES_API_ORIGIN: "http://localhost:9999",
    },
    url: "http://localhost:3100/en",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});