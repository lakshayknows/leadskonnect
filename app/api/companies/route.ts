import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { getCompanies } from "@/lib/queries";

export const runtime = "nodejs";

// GET /api/companies — contacts grouped by company, with counts.
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  return ok(await getCompanies(ctx.orgId));
}
