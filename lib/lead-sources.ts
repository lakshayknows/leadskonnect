/**
 * Lead sources — inbound adapters plus optional monthly spend, so the ageing
 * view's source labels and the PRD's cost-per-source ROI reporting have
 * something to join against. The four known keys are seeded with a friendly
 * label and setup copy on first visit; ingestion itself never depends on a
 * `LeadSource` row existing (an unrecognised key still lands, it just has no
 * label or cost attached).
 */
import { prisma } from "./db";
import { ingestKeyFor } from "./ingest-key";
import { env, configured } from "./env";

export type SourceInfo = { key: string; label: string; instructions: string };

export const KNOWN_SOURCES: SourceInfo[] = [
  {
    key: "web_form",
    label: "Website form",
    instructions:
      "POST form submissions as JSON to the URL below. No auth header needed — the key in the URL is the credential.",
  },
  {
    key: "indiamart",
    label: "IndiaMART",
    instructions:
      'Seller panel → Lead Manager → Import/Export Leads → Push API. Choose "Other" as your platform and paste the URL below as the webhook listener.',
  },
  {
    key: "justdial",
    label: "JustDial",
    instructions:
      "There's no self-serve portal for this one — ask your JustDial account manager to deliver leads to the URL below, and get a sample payload from them first.",
  },
  {
    key: "meta_lead_ads",
    label: "Meta Lead Ads",
    instructions:
      'Meta App Dashboard → Webhooks → Page → Subscribe to the "leadgen" field. Use the URL below, and set the Verify Token to whatever you put in META_VERIFY_TOKEN.',
  },
];

/** Deterministic per-org, per-source webhook URL third parties post leads to. */
export function ingestUrlFor(organizationId: string, sourceKey: string): string {
  return `${env.appUrl}/api/inbound/${sourceKey}?org=${organizationId}&key=${ingestKeyFor(organizationId)}`;
}

/** Idempotent: seeds the 4 known sources for an org the first time anyone visits. */
export async function ensureKnownSources(organizationId: string) {
  await prisma.leadSource.createMany({
    data: KNOWN_SOURCES.map((s) => ({ organizationId, key: s.key, label: s.label })),
    skipDuplicates: true,
  });
}

export async function listSources(organizationId: string) {
  await ensureKnownSources(organizationId);
  const sources = await prisma.leadSource.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  return sources.map((s) => {
    const info = KNOWN_SOURCES.find((k) => k.key === s.key);
    return {
      id: s.id,
      key: s.key,
      label: s.label,
      monthlyCost: s.monthlyCost ? Number(s.monthlyCost) : null,
      active: s.active,
      instructions: info?.instructions ?? "Custom source — map its payload fields in lib/channels/inbound.ts.",
      ingestUrl: ingestUrlFor(organizationId, s.key),
      // The three other sources need only the URL; Meta additionally needs the
      // signature/verify-token env vars before it will accept anything.
      needsEnvSetup: s.key === "meta_lead_ads" && !configured.meta,
    };
  });
}
