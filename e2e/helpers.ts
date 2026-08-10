import type { Page } from "@playwright/test";

/**
 * Test accounts are tagged so they can be found and deleted afterwards.
 * These land in whatever database .env.local points at — which may be the same
 * Supabase project production uses, hence the obvious prefix.
 */
export const E2E_PREFIX = "e2e-tour-";

export function testEmail() {
  return `${E2E_PREFIX}${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.invalid`;
}

/** Sign up a brand-new user and land on the dashboard as a first-login visitor. */
export async function signUpFresh(page: Page) {
  const email = testEmail();
  // Retry once: the database is in ap-southeast-2 and better-auth bcrypts on
  // sign-up, so a cold first request can be slow enough to look like a failure.
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await page.request.post("/api/auth/sign-up/email", {
        data: { email, password: "Testpass123!", name: "E2E Tour" },
        timeout: 60_000,
      });
      if (res.ok()) return email;
      lastErr = `${res.status()} ${await res.text()}`;
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  throw new Error(`sign-up failed after 2 attempts: ${lastErr}`);
}

/** Poll the persisted state — the tour's writes are fire-and-forget by design. */
export async function onboardingState(page: Page) {
  const res = await page.request.get("/api/onboarding", { timeout: 30_000 });
  return (await res.json()).data as {
    completedAt: string | null; skippedAt: string | null; step: number;
    tourVersion: number; theme: string | null; checklistDismissedAt: string | null;
  };
}

export const ring = (page: Page) => page.locator(".ft-tour-ring");
export const callout = (page: Page) => page.locator("dialog.ft-tour-dialog");
export const stepHeading = (page: Page) => callout(page).locator("h2");

/** Ring geometry vs the element it claims to be spotlighting. */
export async function ringMatchesTarget(page: Page, targetId: string, tolerance = 10) {
  const target = page.locator(`[data-tour="${targetId}"]`);
  const t = await target.boundingBox();
  const r = await ring(page).boundingBox();
  if (!t || !r) return { ok: false, reason: "missing box", t, r };
  // The ring is padded 6px per side by design.
  const dx = Math.abs(r.x - (t.x - 6));
  const dy = Math.abs(r.y - (t.y - 6));
  const dw = Math.abs(r.width - (t.width + 12));
  const dh = Math.abs(r.height - (t.height + 12));
  return {
    ok: dx <= tolerance && dy <= tolerance && dw <= tolerance && dh <= tolerance,
    dx, dy, dw, dh, t, r,
  };
}
