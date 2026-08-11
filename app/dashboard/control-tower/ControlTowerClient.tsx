"use client";

import useSWR from "swr";
import Link from "next/link";
import { Radio, Mail, Link as LinkIcon, MessageSquare, Sparkles, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { DashHeader, Panel, EmptyState, Skeleton, Badge } from "@/components/ui";

type Row = {
  pipelineItemId: string;
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null; company: string | null };
  stage: string;
  department: string;
  owner: { id: string; name: string; email: string } | null;
  lastEvent: { channel: string; direction: string; preview: string; occurredAt: string } | null;
  awaitingReply: boolean;
};

const channelIcon = (channel?: string) => {
  switch (channel) {
    case "email": return <Mail className="h-3.5 w-3.5" />;
    case "linkedin": return <LinkIcon className="h-3.5 w-3.5" />;
    case "whatsapp": return <MessageSquare className="h-3.5 w-3.5" />;
    default: return <Sparkles className="h-3.5 w-3.5" />;
  }
};

export default function ControlTowerClient() {
  const { data, isLoading } = useSWR<Row[]>("/api/control-tower", { refreshInterval: 30_000 });
  const rows = data ?? [];
  const awaiting = rows.filter((r) => r.awaitingReply).length;

  return (
    <>
      <DashHeader
        title="Control tower"
        subtitle="Every open conversation across channels, leads waiting on a reply surfaced first."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel>
            <Radio className="mb-3 h-5 w-5 text-ink-soft" />
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="font-display text-3xl font-extrabold tabular-nums">{rows.length}</div>
            )}
            <div className="mt-0.5 font-mono text-xs uppercase tracking-wide text-ink-soft">Open conversations</div>
          </Panel>
          <Panel className={awaiting > 0 ? "!border-warning/40" : undefined}>
            <ArrowDownLeft className="mb-3 h-5 w-5 text-warning" />
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="font-display text-3xl font-extrabold tabular-nums">{awaiting}</div>
            )}
            <div className="mt-0.5 font-mono text-xs uppercase tracking-wide text-ink-soft">Waiting on a reply</div>
          </Panel>
        </div>

        {isLoading && (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b border-line px-4 py-3.5 last:border-0">
                <Skeleton className="h-3.5 max-w-[26%] flex-1" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3.5 flex-1" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing open right now"
            body="Every active pipeline item shows up here the moment a channel touches it — nothing has, yet."
          />
        )}

        {!isLoading && rows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Pipeline / stage</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Last activity</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const name =
                    [r.lead.firstName, r.lead.lastName].filter(Boolean).join(" ") || r.lead.email || "Unnamed";
                  return (
                    <tr key={r.pipelineItemId} className={r.awaitingReply ? "bg-warning-soft/30" : undefined}>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/leads/${r.lead.id}`} className="font-medium hover:text-accent hover:underline">
                          {name}
                        </Link>
                        {r.lead.company && <div className="text-xs text-ink-soft">{r.lead.company}</div>}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        <span className="capitalize">{r.department}</span> · {r.stage}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{r.owner?.name ?? "Unassigned"}</td>
                      <td className="px-4 py-3">
                        {r.lastEvent ? (
                          <div className="flex items-center gap-1.5 text-ink-soft">
                            {r.lastEvent.direction === "inbound" ? (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-warning" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-ink-faint" />
                            )}
                            {channelIcon(r.lastEvent.channel)}
                            <span className="max-w-[16rem] truncate">{r.lastEvent.preview || "(no preview)"}</span>
                          </div>
                        ) : (
                          <span className="text-ink-faint">No messages yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.awaitingReply ? (
                          <Badge tone="warning">Needs reply</Badge>
                        ) : (
                          <Badge tone="neutral">Up to date</Badge>
                        )}
                      </td>
                      <td className={cn("px-4 py-3 text-right font-mono text-xs text-ink-soft")}>
                        {r.lastEvent ? new Date(r.lastEvent.occurredAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
