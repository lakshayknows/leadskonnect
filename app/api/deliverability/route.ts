import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { getDeliverability } from "@/lib/deliverability";

export const runtime = "nodejs";

// GET /api/deliverability?days=30
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 30), 7), 90);
  return ok(await getDeliverability(ctx.orgId, days));
}
