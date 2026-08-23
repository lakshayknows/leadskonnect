"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { AtSign, Globe, Loader2, Plus, ShieldCheck } from "lucide-react";
import { api } from "@/lib/client";
import { Badge, Banner, Button, Panel } from "@/components/ui";
import { DnsRecordTable, type DnsRecord } from "@/components/dashboard/DnsRecordTable";

type DomainDetail = {
  id: string;
  name: string;
  status: string;
  dnsMode: "auto" | "manual";
  nameservers: string[];
  expiresAt: string | null;
  autoRenew: boolean;
  verifiedAt: string | null;
  failureReason: string | null;
  records: DnsRecord[];
  mailboxes: { id: string; name: string; email: string; provider: string; active: boolean }[];
};

const STATUS_LABEL: Record<string, string> = {
  dns_pending: "Waiting on DNS",
  active: "Ready to send",
  failed: "Needs attention",
  expired: "Expired",
};

const STATUS_TONE: Record<string, "success" | "accent" | "warning" | "danger" | "neutral"> = {
  active: "success",
  dns_pending: "accent",
  failed: "danger",
  expired: "danger",
};

export default function DomainDetailClient({ id }: { id: string }) {
  const { data: domain, mutate } = useSWR<DomainDetail>(`/api/domains/${id}`, {
    refreshInterval: (d) => (d?.status === "dns_pending" ? 30_000 : 0),
  });
  const [rechecking, setRechecking] = useState(false);

  if (!domain) {
    return (
      <div className="p-8">
        <Loader2 className="h-5 w-5 animate-spin text-ink-soft" aria-label="Loading" />
      </div>
    );
  }

  async function recheck() {
    setRechecking(true);
    try {
      await api(`/api/domains/${id}/verify`, { method: "POST", body: {} });
      mutate();
    } finally {
      setRechecking(false);
    }
  }

  return (
    <div className="space-y-6 p-8">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
              <Globe className="h-5 w-5 text-accent" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-xl font-extrabold">{domain.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[domain.status] ?? "neutral"}>
                  {STATUS_LABEL[domain.status] ?? domain.status}
                </Badge>
                <span className="text-xs text-ink-soft">
                  {domain.dnsMode === "auto" ? "DNS managed for you" : "DNS at your own host"}
                </span>
                {domain.expiresAt && (
                  <span className="text-xs text-ink-soft">
                    · Renews {new Date(domain.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link href={`/dashboard/accounts/new?step=mailbox&domain=${domain.id}`} className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden /> Connect a mailbox
          </Link>
        </div>

        {domain.failureReason && (
          <div className="mt-5">
            <Banner kind="error">{domain.failureReason}</Banner>
          </div>
        )}
      </Panel>

      <Panel>
        <DnsRecordTable
          records={domain.records}
          mode={domain.dnsMode}
          onRecheck={recheck}
          rechecking={rechecking}
          lastCheckedAt={domain.records[0]?.lastCheckedAt ?? null}
        />
        {domain.nameservers.length > 0 && (
          <p className="mt-4 font-mono text-[11px] text-ink-soft">
            Nameservers: {domain.nameservers.join(", ")}
          </p>
        )}
      </Panel>

      <Panel>
        <h3 className="font-display text-lg font-bold">Mailboxes</h3>

        {domain.mailboxes.length === 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            No mailboxes on this domain yet. A verified domain does nothing on its own — add a
            mailbox to start sending from it.
          </p>
        )}

        {domain.mailboxes.length > 0 && (
          <ul className="mt-4 space-y-2">
            {domain.mailboxes.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <AtSign className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{m.email}</span>
                {m.provider === "managed" && <Badge tone="accent">Managed</Badge>}
                {m.active ? <Badge tone="success">Active</Badge> : <Badge>Paused</Badge>}
              </li>
            ))}
          </ul>
        )}

      </Panel>

      {domain.verifiedAt && (
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
          Verified {new Date(domain.verifiedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
