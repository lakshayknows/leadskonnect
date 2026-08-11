import { test, expect } from "@playwright/test";
import { signUpFresh, callout } from "./helpers";

test.describe("theme", () => {
  test("dark mode applies real token values, not baked light ones", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/dashboard");
    await page.locator("dialog.ft-tour-dialog").isVisible().catch(() => {});

    const light = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return { canvas: cs.getPropertyValue("--canvas").trim(), theme: document.documentElement.dataset.theme };
    });

    await page.evaluate(() => {
      document.cookie = "ft-theme=dark; path=/; max-age=31536000";
    });
    await page.reload();

    const dark = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        canvas: cs.getPropertyValue("--canvas").trim(),
        theme: document.documentElement.dataset.theme,
        bodyBg: body.backgroundColor,
        colorScheme: cs.colorScheme,
      };
    });

    expect(light.theme).toBe("light");
    expect(dark.theme).toBe("dark");
    expect(dark.canvas).not.toBe(light.canvas);
    expect(dark.colorScheme).toContain("dark");
    // The dark canvas must actually be dark, not white-with-a-dark-attribute.
    const rgb = dark.bodyBg.match(/\d+/g)!.map(Number);
    const luma = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    expect(luma, `body background should be dark, got ${dark.bodyBg}`).toBeLessThan(0.2);
  });

  test("no light flash when the theme cookie says dark", async ({ page, context }) => {
    await signUpFresh(page);
    await context.addCookies([
      { name: "ft-theme", value: "dark", url: "http://localhost:3000" },
    ]);

    // `commit` lands before <head> scripts run, so it cannot tell us anything
    // about the no-flash script. DOMContentLoaded is the earliest point at which
    // the blocking script is guaranteed to have executed — and crucially, still
    // before React hydrates, so this proves the attribute is server-resolved.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme, "theme must be resolved by the blocking script, pre-hydration").toBe("dark");
  });

  test("the theme toggle switches and persists", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Skip the tour" }).click().catch(() => {});

    await page.getByRole("button", { name: "Account and workspace menu" }).click();
    await page.getByRole("radio", { name: "Dark" }).click();

    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");

    await page.reload();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme), {
      message: "theme survives reload via cookie",
    }).toBe("dark");
  });
});

test.describe("overlays replace native dialogs", () => {
  test("deleting a contact opens a real dialog, not window.confirm", async ({ page }) => {
    await signUpFresh(page);

    // A native confirm() would block and never fire this handler.
    let nativeDialogFired = false;
    page.on("dialog", async (d) => {
      nativeDialogFired = true;
      await d.dismiss();
    });

    await page.request.post("/api/leads", {
      data: { firstName: "Delete", email: `e2e-del-${Date.now()}@example.invalid`, company: "Acme" },
    });

    await page.goto("/dashboard/leads");
    // Deep-linking must not drag the user to /dashboard.
    await expect(page).toHaveURL(/\/dashboard\/leads/);

    const del = page.getByRole("button", { name: "Delete" }).first();
    await del.click();

    const dialog = page.locator("dialog.ft-dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Delete this lead?");
    await expect(dialog).toContainText("suppression list");
    expect(nativeDialogFired, "must not use window.confirm").toBe(false);

    // Escape closes it without leaving React out of sync — reopening must work.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await del.click();
    await expect(page.locator("dialog.ft-dialog[open]")).toBeVisible();
  });

  test("creating a workspace uses a prompt dialog with validation", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Skip the tour" }).click().catch(() => {});

    await page.getByRole("button", { name: "Account and workspace menu" }).click();
    await page.getByRole("button", { name: "New workspace" }).click();

    const dialog = page.locator("dialog.ft-dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Create a workspace");

    // Empty submit is blocked inline rather than silently doing nothing.
    await dialog.getByRole("button", { name: "Create workspace" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
  });
});

test.describe("empty states and loading", () => {
  test("a fresh workspace shows a real empty state, not a blank table", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/dashboard/leads");
    await expect(page, "the tour must not hijack a deep link").toHaveURL(/\/dashboard\/leads/);

    await expect(page.getByText("No leads yet")).toBeVisible();
    await expect(page.getByText(/Import a CSV/i)).toBeVisible();
  });

  test("the activation checklist derives progress from real data", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Skip the tour" }).click().catch(() => {});

    await expect(page.getByText("Finish setting up")).toBeVisible();
    await expect(page.getByText("0 of 5")).toBeVisible();

    // Adding a contact must move the counter without any stored flag.
    await page.request.post("/api/leads", {
      data: { firstName: "Check", email: `e2e-act-${Date.now()}@example.invalid` },
    });
    // getActivation is cached 30s server-side, so the counter cannot move before
    // that window elapses — wait it out rather than pretending otherwise.
    await page.waitForTimeout(31_000);
    await page.reload();
    await page.getByRole("button", { name: "Skip the tour" }).click().catch(() => {});
    await expect(page.getByText(/[1-5] of 5/)).toBeVisible({ timeout: 40_000 });
  });
});

test.describe("settings navigation", () => {
  test("sub-pages have a way back, which they previously did not", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/dashboard/settings/profile");
    await expect(page).toHaveURL(/\/dashboard\/settings\/profile/);

    await expect(page.getByRole("link", { name: "All settings" })).toBeVisible();
    await page.getByRole("link", { name: "All settings" }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
  });
});
