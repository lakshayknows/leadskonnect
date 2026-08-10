"use client";

import useSWR from "swr";
import { ShieldCheck, ShieldAlert, Download } from "lucide-react";
import { DashHeader, Panel, Badge, Skeleton, EmptyState } from "@/components/ui";

type Entry = {
  id: string;
  sequence: number;
  eventType: string;
  payload: { email?: string; phone?: string; reason?: string };
  hash: string;
  createdAt: string;
};
type Payload = { entries: Entry[]; verification: { ok: boolean; entries: number; brokenAtSequence: number | null } };

export default function ComplianceClient() {
  const { data, isLoading } = useSWR<Payload>("/api/compliance-ledger");
  const entries = data?.entries ?? [];
  const verification = data?.verification;

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DashHeader
        title="Compliance ledger"
        subtitle="Every consent/suppression event, hash-chained — altering a past entry breaks every hash after it."
        action={
          entries.length > 0 ? (
            <button onClick={exportJson} className="btn btn-ghost !px-4 !py-2 text-sm">
              <Download className="h-3.5 w-3.5" /> Export JSON
            </button>
          ) : null
        }
      />

      <div className="mx-auto max-w-3xl space-y-6 p-8">
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : (
          <Panel className={verification?.ok ? undefined : "!border-danger/40"}>
            <div className="flex items-center gap-3">
              {verification?.ok ? (
                <ShieldCheck className="h-6 w-6 text-success" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-danger" />
              )}
              <div>
                <div className="font-display text-base font-bold">
                  {verification?.ok ? "Chain verified" : "Chain broken"}
                </div>
                <p className="text-xs text-ink-soft">
                  {verification?.entries ?? 0} entries.{" "}
                  {verification?.ok
                    ? "Every hash matches its predecessor — nothing has been altered."
                    : `First break at entry #${verification?.brokenAtSequence}.`}
                </p>
              </div>
              <Badge tone={verification?.ok ? "success" : "danger"} className="ml-auto">
                {verification?.ok ? "OK" : "TAMPERED"}
              </Badge>
            </div>
          </Panel>
        )}

        {!isLoading && entries.length === 0 && (
          <EmptyState
            icon={ShieldCheck}
            title="No entries yet"
            body="Every unsubscribe, bounce, GDPR erase, or manual suppression writes here automatically — nothing to configure."
          />
        )}

        {!isLoading && entries.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-mono text-xs text-ink-faint">{e.sequence}</td>
                    <td className="px-4 py-3">{e.eventType}</td>
                    <td className="px-4 py-3 text-ink-soft">{e.payload.email ?? e.payload.phone ?? "—"}</td>
                    <td className="px-4 py-3"><span className="capitalize">{e.payload.reason ?? "—"}</span></td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-ink-soft">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
