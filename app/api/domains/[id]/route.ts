import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { requireOrg } from "@/lib/tenant";
import { storefrontEmailUrl } from "@/lib/domains/storefront";
import { providerById, connectMethodFor } from "@/lib/domains";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/domains/[id] — one domain with its DNS records and mailboxes. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg(req);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  // findFirst with the org in the WHERE, never findUnique by id — that is the
  // difference between a scoped read and a cross-tenant leak.
  const domain = await prisma.domain.findFirst({
    where: { id, organizationId: ctx.orgId },
    select: {
      id: true,
      name: true,
      status: true,
      dnsMode: true,
      mailProvider: true,
      nameservers: true,
      expiresAt: true,
      autoRenew: true,
      verifiedAt: true,
      failureReason: true,
      checkAttempts: true,
      nextCheckAt: true,
      createdAt: true,
      records: {
        select: {
          id: true,
          kind: true,
          type: true,
          host: true,
          expectedValue: true,
          observedValue: true,
          priority: true,
          status: true,
          lastCheckedAt: true,
        },
        orderBy: { kind: "asc" },
      },
      // Safe field list only — a SendingAccount carries pass / refreshToken /
      // dkimPrivateKey and none of those may reach a client.
      mailboxes: {
        select: { id: true, name: true, email: true, provider: true, active: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!domain) return fail("Domain not found", 404);

  // Everything the connect step needs to decide HOW to connect, resolved here so
  // the client never has to know a provider's server names.
  const provider = providerById(domain.mailProvider);

  return ok({
    ...domain,
    storeEmailUrl: storefrontEmailUrl(),
    provider: provider
      ? {
          id: provider.id,
          label: provider.label,
          // "oauth" | "password" | "manual" — drives which connect UI is shown.
          connectMethod: connectMethodFor(provider),
          smtp: provider.smtp,
          imap: provider.imap,
        }
      : null,
  });
}
