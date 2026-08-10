import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { verifyLedger } from "@/lib/compliance-ledger";

export const runtime = "nodejs";

// GET /api/compliance-ledger — the full chain plus a live re-verification, for the
// Compliance settings screen and for exporting a verifiable audit trail.
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const [entries, verification] = await Promise.all([
    prisma.complianceLedgerEntry.findMany({
      where: { organizationId: ctx.orgId },
      orderBy: { sequence: "desc" },
      take: 500,
    }),
    verifyLedger(ctx.orgId),
  ]);

  return ok({ entries, verification });
}
