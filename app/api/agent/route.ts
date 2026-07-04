import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, requireDb } from "@/lib/http";
import { runAgent } from "@/lib/agent";
import { configured } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Fluid Compute default

const RunAgent = z.object({
  leadIds: z.array(z.string()).min(1),
  brief: z.string().min(1),
  maxSteps: z.number().min(1).max(50).optional(),
});

export async function POST(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;
  if (!configured.agent) return fail("NVIDIA_API_KEY not configured", 503);

  const parsed = RunAgent.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("expected { leadIds[], brief, maxSteps? }");

  const result = await runAgent(parsed.data);
  return ok(result);
}
