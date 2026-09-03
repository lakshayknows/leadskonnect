import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireExtAuth } from "@/lib/linkedin/auth";
import { corsPreflight, withCors } from "@/lib/linkedin/cors";
import { detectScrapeKind } from "@/lib/linkedin/detect";
import { completeScrapeJob, importScrapedRows, queueScrapeJob, scrapeUsageToday } from "@/lib/linkedin/scrape";

export const runtime = "nodejs";

export function OPTIONS() {
  return corsPreflight();
}

const Row = z
  .object({
    profileUrl: z.string().max(500),
    fullName: z.string().max(200).optional(),
    firstName: z.string().max(120).optional(),
    lastName: z.string().max(120).optional(),
    headline: z.string().max(500).optional(),
    location: z.string().max(200).optional(),
    company: z.string().max(200).optional(),
    title: z.string().max(200).optional(),
    degree: z.string().max(20).optional(),
  })
  .strip();

const Body = z.object({
  /** The LinkedIn page they were on, so the contact records where it came from. */
  sourceUrl: z.string().max(1000),
  rows: z.array(Row).min(1).max(100),
});

/**
 * POST /api/linkedin/scrape/collect
 *
 * The in-page bar's endpoint: someone ticked specific people on a LinkedIn page
 * and pressed Add. Distinct from the queue in ../claim, which exists for bulk
 * reads the app asked for.
 *
 * It imports immediately rather than staging for review, and that is the right
 * call here: the review step exists because a pasted search URL might return two
 * thousand strangers. Here they looked at each person and ticked a box — asking
 * them to confirm again would be asking twice.
 */
export async function POST(req: NextRequest) {
  const account = await requireExtAuth(req);
  if (account instanceof Response) return withCors(account);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return withCors(fail(parsed.error.issues[0]?.message ?? "invalid body"));
  const { sourceUrl, rows } = parsed.data;

  const { organizationId, userId } = account;

  // Same daily ceiling as a bulk read. Hand-picking is gentler on LinkedIn, but
  // a cap that one path can sidestep is not a cap.
  const usage = await scrapeUsageToday(organizationId, userId);
  if (usage.remaining <= 0) {
    return withCors(
      fail(`Daily limit reached (${usage.used} of ${usage.cap}). Resets at midnight.`, 429),
    );
  }
  const accepted = rows.slice(0, usage.remaining);

  // Recorded as a job like any other, so it shows in Activity, counts toward the
  // cap, and carries the same provenance rather than appearing from nowhere.
  const detected = detectScrapeKind(sourceUrl);
  const job = await queueScrapeJob({
    organizationId,
    userId,
    kind: detected?.kind ?? "search_export",
    inputUrl: detected?.url ?? sourceUrl,
    maxResults: accepted.length,
  });

  await completeScrapeJob({ organizationId, jobId: job.id, rows: accepted });
  const result = await importScrapedRows({ organizationId, jobId: job.id });

  return withCors(
    ok({
      jobId: job.id,
      received: accepted.length,
      created: result.created,
      duplicates: result.duplicates,
      skipped: rows.length - accepted.length,
    }),
  );
}
