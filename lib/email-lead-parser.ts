/**
 * Email-parsing fallback for lead-aggregator notification emails (dev PRD §3.7-3.8) — for
 * a JustDial/Sulekha/TradeIndia account tier that doesn't offer a webhook. Wired to a
 * SendingAccount whose `leadSourceKey` is set (lib/inbox/poller.ts): its inbound mail is
 * parsed as a new lead instead of matched as a reply.
 *
 * Treated more defensively than any webhook adapter, per the dev PRD's own warning:
 * payload format is account-manager-dependent and unverified until there's a real sample
 * to build against. This extracts a generic "Label: value" line format as a best effort
 * — most aggregator notification emails do use recognizable labels (Name/Mobile/Email/
 * Category) — rather than assuming one specific layout.
 */
import { mapPayload } from "./channels/inbound";
import type { InboundEvent } from "./channels/types";

/** "Name: John Doe" / "Mobile - 9876543210" style lines → a flat key/value object. */
function parseKeyValueLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9 _/]{1,40}?)\s*[:=]\s*(.+?)\s*$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

export function parseLeadEmail(sourceKey: string, input: { subject?: string; body?: string }): InboundEvent | null {
  const fields = parseKeyValueLines(`${input.subject ?? ""}\n${input.body ?? ""}`);
  return mapPayload(fields, sourceKey);
}
