import { NextRequest } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { invalidate } from "@/lib/cache";

export const runtime = "nodejs";

// Known columns map onto lead fields; everything else becomes a custom variable.
const KNOWN = new Set(["email", "firstname", "lastname", "phone", "linkedinurl", "company", "title"]);

function normalizeRow(row: Record<string, string>) {
  const lead: Record<string, unknown> = {};
  const custom: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const key = rawKey.trim().toLowerCase().replace(/\s+/g, "");
    if (!value) continue;
    switch (key) {
      case "email": lead.email = value.trim().toLowerCase(); break;
      case "firstname": lead.firstName = value; break;
      case "lastname": lead.lastName = value; break;
      case "phone": lead.phone = value; break;
      case "linkedinurl": lead.linkedinUrl = value; break;
      case "company": lead.company = value; break;
      case "title": lead.title = value; break;
      default:
        if (!KNOWN.has(key)) custom[rawKey.trim()] = value;
    }
  }
  return { lead, custom };
}

// POST /api/leads/import  — body: raw CSV text (Content-Type text/csv) OR { csv: "..." }
export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { orgId } = ctx;

  const contentType = req.headers.get("content-type") ?? "";
  let csv: string;
  if (contentType.includes("application/json")) {
    const j = await req.json().catch(() => null);
    csv = j?.csv;
  } else {
    csv = await req.text();
  }
  if (!csv || csv.trim() === "") return fail("empty CSV");

  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) return fail(`CSV parse error: ${parsed.errors[0].message}`);

  const results = { imported: 0, skipped: 0, errors: [] as string[] };
  for (const row of parsed.data) {
    const { lead, custom } = normalizeRow(row);
    if (!lead.email) {
      results.skipped++;
      results.errors.push(`row missing email: ${JSON.stringify(row).slice(0, 80)}`);
      continue;
    }
    try {
      await prisma.lead.upsert({
        where: { organizationId_email: { organizationId: orgId, email: lead.email as string } },
        create: { ...(lead as object), organizationId: orgId, custom } as never,
        update: { ...(lead as object), custom } as never,
      });
      results.imported++;
    } catch (e) {
      results.skipped++;
      results.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (results.imported > 0) {
    invalidate("leads:");
    invalidate("stats");
  }
  return ok(results);
}
