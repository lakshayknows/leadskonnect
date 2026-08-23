"use client";

import useSWR from "swr";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { DashHeader, Panel, EmptyState, Skeleton, Badge } from "@/components/ui";

type AgeingItem = {
  id: string;
  overdueHours: number;
  stage: { id: string; name: string; slaHours: number | null };
  pipeline: { id: string; name: string; department: string };
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null; company: string | null };
  source: { key: string; label: string } | null;
};
type Payload = { items: AgeingItem[]; aiShare: { total: number; ai: number; share: number } };

/** Escalation urgency is a function of how far past SLA, not which team owns it. */
function severity(hours: number) {
  if (hours >= 72) return { tone: "danger" as const, label: "Critical" };
  if (hours >= 24) return { tone: "warning" as const, label: "Overdue" };
  return { tone: "neutral" as const, label: "Just missed" };
}

export default function AgeingClient() {
  const { data, isLoading } = useSWR<Payload>("/api/ageing");
  const items = data?.items ?? [];
  const ai = data?.aiShare;

  return (
    <>
      <DashHeader
        title="Ageing"
        subtitle="Everything past its SLA, across every pipeline, most overdue first."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel>
            <AlertTriangle className="mb-3 h-5 w-5 text-ink-soft" />
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="font-display text-3xl font-extrabold tabular-nums">{items.length}</div>
            )}
            <div className="mt-0.5 font-mono text-xs uppercase tracking-wide text-ink-soft">Past SLA</div>
          </Panel>
          <Panel>
            <AlertTriangle className="mb-3 h-5 w-5 text-ink-soft" />
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="font-display text-3xl font-extrabold tabular-nums">
                {items.filter((i) => i.overdueHours >= 72).length}
              </div>
            )}
            <div className="mt-0.5 font-mono text-xs uppercase tracking-wide text-ink-soft">Critical (72h+)</div>
          </Panel>
          <Panel>
            <Bot className="mb-3 h-5 w-5 text-ink-soft" />
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="font-display text-3xl font-extrabold tabular-nums">
                {ai ? Math.round(ai.share * 100) : 0}%
              </div>
            )}
            <div className="mt-0.5 font-mono text-xs uppercase tracking-wide text-ink-soft">
              Stage moves by AI
            </div>
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

        {!isLoading && items.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing is overdue"
            body="Every lead in every pipeline is inside its stage's SLA. Items appear here the moment one is breached, and escalate up the reporting line."
          />
        )}

        {!isLoading && items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Pipeline</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 text-right font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((i) => {
                  const sev = severity(i.overdueHours);
                  const name =
                    [i.lead.firstName, i.lead.lastName].filter(Boolean).join(" ") || i.lead.email || "Unnamed";
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-3">
                        <Link href="/dashboard/leads" className="font-medium hover:text-accent">
                          {name}
                        </Link>
                        {i.lead.company && <div className="text-xs text-ink-soft">{i.lead.company}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-ink-soft">{i.pipeline.department}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{i.stage.name}</td>
                      <td className="px-4 py-3">
                        {i.source ? <Badge tone="neutral">{i.source.label}</Badge> : <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn("font-mono tabular-nums", sev.tone === "danger" ? "text-danger" : "text-warning")}>
                          {i.overdueHours}h
                        </span>
                        <div className="text-[10px] uppercase tracking-wide text-ink-faint">{sev.label}</div>
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
