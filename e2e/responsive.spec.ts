import { test, expect } from "@playwright/test";
import { signUpFresh, callout } from "./helpers";

const SIZES = [
  { name: "desktop", width: 1440, height: 900, tour: true },
  { name: "laptop", width: 1024, height: 800, tour: true },
  { name: "tablet", width: 768, height: 900, tour: false },
  { name: "phone", width: 375, height: 780, tour: false },
];

for (const s of SIZES) {
  test(`${s.name} (${s.width}px): layout holds and the tour ${s.tour ? "runs" : "stays off"}`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await signUpFresh(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // The tour is desktop-gated at 1024px by design.
    if (s.tour) {
      await expect(callout(page)).toBeVisible({ timeout: 20_000 });
      await page.getByRole("button", { name: "Skip the tour" }).click();
    } else {
      await expect(callout(page), "tour must not autostart on narrow screens").toBeHidden();
      const state = await (await page.request.get("/api/onboarding")).json();
      expect(state.data.completedAt, "and must not mark itself done").toBeNull();
      expect(state.data.skippedAt).toBeNull();
    }

    // Nothing may overflow horizontally at any width.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${s.width}px`).toBeLessThanOrEqual(1);
  });
}

test("below lg the sidebar is a drawer behind a menu button", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await signUpFresh(page);
  await page.goto("/dashboard");

  const openBtn = page.getByRole("button", { name: "Open navigation" });
  await expect(openBtn).toBeVisible();

  // Closed: the rail is translated off-canvas.
  const contactsLink = page.locator('[data-tour="sidebar-contacts"]');
  await expect(contactsLink).not.toBeInViewport();

  await openBtn.click();
  await expect(contactsLink).toBeInViewport();

  // Escape closes it.
  await page.keyboard.press("Escape");
  await expect(contactsLink).not.toBeInViewport();
});

test("at desktop width the rail is always visible with no menu button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUpFresh(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Skip the tour" }).click().catch(() => {});

  await expect(page.locator('[data-tour="sidebar-contacts"]')).toBeInViewport();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
});
