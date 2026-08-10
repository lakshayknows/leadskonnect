"use client";

import useSWR from "swr";
import { Users, Send, Reply, Rocket } from "lucide-react";
import { DashHeader, Panel, Skeleton } from "@/components/ui";
import { ActivationChecklist } from "@/components/dashboard/ActivationChecklist";
import { tourTarget } from "@/components/dashboard/tour/target";

type Stats = { leads: number; sentToday: number; replies: number; activeCampaigns: number; suppressed: number };

export default function Overview({ checklistDismissed = false }: { checklistDismissed?: boolean }) {
  const { data: stats, error, isLoading } = useSWR<Stats>("/api/stats");
  const err = error ? (error as Error).message : null;

  const tiles = [
    { label: "Contacts", value: stats?.leads, icon: Users },
    { label: "Sent today", value: stats?.sentToday, icon: Send },
    { label: "Replies", value: stats?.replies, icon: Reply },
    { label: "Active campaigns", value: stats?.activeCampaigns, icon: Rocket },
  ];

  return (
    <>
      <DashHeader title="Overview" subtitle="Your outreach at a glance." />
      <div className="p-8">
        {err && (
          <p className="mb-4 text-sm text-danger">
            Couldn&apos;t load your stats: {err}. Reload to try again.
          </p>
        )}

        <div {...tourTarget("overview-stats")} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {tiles.map((t) => (
            <Panel key={t.label}>
              <t.icon className="mb-3 h-5 w-5 text-ink-soft" />
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <div className="font-display text-3xl font-extrabold tabular-nums">
                  {t.value?.toLocaleString() ?? "—"}
                </div>
              )}
              <div className="mt-0.5 font-mono text-xs uppercase tracking-wide text-ink-soft">{t.label}</div>
            </Panel>
          ))}
        </div>

        <ActivationChecklist dismissed={checklistDismissed} />
      </div>
    </>
  );
}
