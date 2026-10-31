import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the production build served by `vite preview`
 * (started in webServer). CI runs Chromium + Firefox + WebKit.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    viewport: { width: 1360, height: 850 },
    // The suite asserts the primary zh-CN UI; language switching is itself tested.
    locale: "zh-CN",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
