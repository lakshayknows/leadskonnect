import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against the local dev server, which is where the branch's code lives.
 * Production (followthroo.com) is deployed from `main` and does not have this
 * work yet, so only the read-only prod smoke spec targets it.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // the specs share one database
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 25_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 60_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        // Production build, not `next dev`: dev compiles routes on demand, so
        // the first navigation to each page pays a multi-second compile that
        // has nothing to do with the product and swamps the tour's timings.
        command: "npm run build && npm run start",
        url: "http://localhost:3000/sign-in",
        reuseExistingServer: true,
        timeout: 300_000,
      },
});
