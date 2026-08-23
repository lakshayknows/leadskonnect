"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, Check, Globe, Loader2, Plus, ShieldAlert } from "lucide-react";
import { Badge, Panel } from "@/components/ui";

type DomainRow = {
  id: string;
  name: string;
  status: string;
  dnsMode: string;
  expiresAt: string | null;
  mailboxCount: number;
  recordsVerified: number;
  recordsTotal: number;
};

type Payload = { available: boolean; domains: DomainRow[] };

const STATUS_LABEL: Record<string, string> = {
  dns_pending: "Waiting on DNS",
  active: "Ready to send",
  failed: "Needs attention",
  expired: "Expired",
};

const TONE: Record<string, "success" | "accent" | "warning" | "danger" | "neutral"> = {
  active: "success",
  dns_pending: "accent",
  failed: "danger",
  expired: "danger",
};

/** Four dots rather than a bar: at this size the count reads faster than a fill. */
function RecordDots({ verified, total }: { verified: number; total: number }) {
  if (total === 0) return null;
  return (
    <span className="flex items-center gap-1.5" title={`${verified} of ${total} DNS records verified`}>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i < verified ? "bg-success" : "bg-line-strong"}`}
          />
        ))}
      </span>
      <span className="font-mono text-[11px] text-ink-soft">
        {verified}/{total} DNS
      </span>
    </span>
  );
}

/**
 * Sits above the mailbox list on the Accounts screen. Deliberately a panel on an
 * existing screen rather than a nav row — the rail is the product's table of
 * contents and this is not one of its five questions.
 */
export function SendingDomainsPanel() {
  const { data } = useSWR<Payload>("/api/domains");

  // Hidden entirely when the integration isn't configured, rather than showing a
  // button that leads to a dead end.
  if (!data?.available) return null;

  const domains = data.domains ?? [];

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Sending domains</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            A separate domain keeps cold outreach away from the one your invoices go out on.
          </p>
        </div>
        <Link href="/dashboard/accounts/new" className="btn btn-ghost !px-3.5 !py-2 text-sm">
          <Plus className="h-4 w-4" aria-hidden /> Get a domain
        </Link>
      </div>

      {domains.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line p-6 text-center">
          <Globe className="mx-auto h-6 w-6 text-ink-soft" aria-hidden />
          <p className="mt-3 text-sm text-ink-soft">
            No sending domain yet. Pick a name, buy it in our store, and we&apos;ll verify the
            mail records and connect the mailbox.
          </p>
          <Link href="/dashboard/accounts/new" className="btn btn-primary mt-4 !px-4 !py-2 text-sm">
            Get a sending domain <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {domains.map((d) => {
            // A domain still waiting on DNS goes back into the wizard at the step
            // it stalled on, rather than to a detail page it can do nothing with.
            const inFlight = d.status === "dns_pending";
            const href = inFlight
              ? `/dashboard/accounts/new?domain=${d.id}&step=dns`
              : `/dashboard/accounts/domains/${d.id}`;
            return (
              <li key={d.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-xl border border-line p-3.5 transition-colors hover:border-ink"
                >
                  {d.status === "active" ? (
                    <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
                  ) : d.status === "failed" || d.status === "expired" ? (
                    <ShieldAlert className="h-4 w-4 shrink-0 text-danger" aria-hidden />
                  ) : (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm font-medium">{d.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <RecordDots verified={d.recordsVerified} total={d.recordsTotal} />
                      <span className="text-[11px] text-ink-soft">
                        {d.mailboxCount} mailbox{d.mailboxCount === 1 ? "" : "es"}
                      </span>
                    </div>
                  </div>

                  <Badge tone={TONE[d.status] ?? "neutral"}>
                    {inFlight ? "Finish setup" : (STATUS_LABEL[d.status] ?? d.status)}
                  </Badge>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
