import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg, requireRole } from "@/lib/tenant";
import { configured } from "@/lib/env";
import { looksLikeDomain } from "@/lib/domains";
import { applyDnsRecords } from "@/lib/domains/provision";

export const runtime = "nodejs";

/**
 * Sending domains for the workspace, each with its DNS record states rolled up
 * so the Accounts screen can show health without a second round trip.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const domains = await prisma.domain.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      dnsMode: true,
      expiresAt: true,
      autoRenew: true,
      verifiedAt: true,
      failureReason: true,
      createdAt: true,
      records: {
        select: {
          id: true,
          kind: true,
          type: true,
          host: true,
          expectedValue: true,
          observedValue: true,
          status: true,
          lastCheckedAt: true,
        },
        orderBy: { kind: "asc" },
      },
      _count: { select: { mailboxes: true } },
    },
  });

  return ok({
    // The storefront path needs no credentials, so this is on by default.
    available: configured.storefront,
    domains: domains.map((d) => ({
      ...d,
      mailboxCount: d._count.mailboxes,
      _count: undefined,
      recordsVerified: d.records.filter((r) => r.status === "verified").length,
      recordsTotal: d.records.length,
    })),
  });
}

const AddSchema = z.object({
  domain: z.string().min(4).max(253),
});

/**
 * POST /api/domains — track a domain the customer just bought on the storefront.
 *
 * The storefront takes the money and we get commission, so there is nothing to
 * charge and nothing to register here. All this does is start tracking the
 * domain so we can verify its DNS and hang mailboxes off it.
 *
 * `dnsMode` is always "manual": the domain lives in the customer's own account
 * at the registrar, not ours, so we can read its DNS but never write it.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;

  const roleGate = requireRole(ctx, ["owner", "admin"]);
  if (roleGate) return roleGate;

  const parsed = AddSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request");

  const name = parsed.data.domain.trim().toLowerCase().replace(/\.$/, "");
  if (!looksLikeDomain(name)) return fail("That doesn't look like a domain name");

  const existing = await prisma.domain.findUnique({
    where: { organizationId_name: { organizationId: ctx.orgId, name } },
    select: { id: true },
  });
  // Idempotent: adding the same domain twice returns the one you already have
  // rather than erroring at someone who pressed the button twice.
  if (existing) {
    await applyDnsRecords(existing.id, name, "manual");
    return ok({ id: existing.id, name, created: false });
  }

  const domain = await prisma.domain.create({
    data: {
      organizationId: ctx.orgId,
      name,
      status: "dns_pending",
      dnsMode: "manual",
      registrar: "storefront",
    },
  });

  // Writes the expected record set and schedules the first check. In manual mode
  // it pushes nothing to the registrar — it only records what we expect to see.
  await applyDnsRecords(domain.id, name, "manual");

  return ok({ id: domain.id, name, created: true }, { status: 201 });
}
