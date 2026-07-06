import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { enrollLeads } from "@/lib/enroll";
import { resolveSegmentLeadIds } from "@/lib/segments";

export const runtime = "nodejs";

// Targeted enrollment: a saved group/segment, a checkbox selection, or a single lead.
const Body = z.object({
  segmentId: z.string().optional(),
  leadIds: z.array(z.string()).optional(),
  leadId: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("expected { segmentId | leadIds[] | leadId }");

  let leadIds: string[] = [];
  if (parsed.data.leadId) leadIds = [parsed.data.leadId];
  else if (parsed.data.leadIds?.length) leadIds = parsed.data.leadIds;
  else if (parsed.data.segmentId) leadIds = await resolveSegmentLeadIds(ctx.orgId, parsed.data.segmentId);
  else return fail("no target specified");

  if (leadIds.length === 0) return fail("no leads to enroll");

  const result = await enrollLeads(ctx.orgId, id, leadIds);
  if ("error" in result) return fail(result.error, result.status);
  return ok(result);
}
