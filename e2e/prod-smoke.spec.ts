import { test, expect } from "@playwright/test";

/**
 * Read-only checks against live production. Deliberately never signs up, writes,
 * or mutates anything — followthroo.com shares a database with real users.
 *
 * Run explicitly:
 *   E2E_BASE_URL=https://www.followthroo.com E2E_NO_SERVER=1 \
 *     npx playwright test e2e/prod-smoke.spec.ts
 */
const isProd = (process.env.E2E_BASE_URL ?? "").includes("followthroo.com");

test.describe("production smoke (read-only)", () => {
  test.skip(!isProd, "only runs when pointed at followthroo.com");

  test("the marketing site is up and titled correctly", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Followthroo/i);
  });

  test("the dashboard is gated behind sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/, { timeout: 30_000 });
  });

  test("reports which build is deployed — tour present or not", async ({ page }) => {
    await page.goto("/sign-in");
    const hasThemeScript = await page.evaluate(() => document.documentElement.dataset.theme !== undefined);
    // Informational, not a gate: production runs `main` until this branch merges.
    console.log(`[prod] theme system deployed: ${hasThemeScript}`);
    expect(typeof hasThemeScript).toBe("boolean");
  });
});
