import { ok } from "@/lib/http";
import { configured } from "@/lib/env";

export const runtime = "nodejs";

// GET /api/status — quick health + which integrations are wired.
export async function GET() {
  return ok({
    app: "overture",
    configured: {
      database: configured.db,
      redis: configured.redis,
      email: configured.email,
      whatsapp: configured.whatsapp,
      linkedin: configured.linkedin,
      anthropic: configured.anthropic,
    },
  });
}
