"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Send, Reply, Rocket, Bot, FileText, ArrowRight } from "lucide-react";
import { api } from "@/lib/client";
import { DashHeader, Panel } from "@/components/dashboard/ui";

type Stats = { leads: number; sentToday: number; replies: number; activeCampaigns: number; suppressed: number };

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("/api/stats").then(setStats).catch((e) => setErr(e.message));
  }, []);

  const tiles = [
    { label: "Leads", value: stats?.leads, icon: Users },
    { label: "Sent today", value: stats?.sentToday, icon: Send },
    { label: "Replies", value: stats?.replies, icon: Reply },
    { label: "Active campaigns", value: stats?.activeCampaigns, icon: Rocket },
  ];

  const shortcuts = [
    { label: "Import leads", href: "/dashboard/leads", icon: Users, body: "Add or upload your contacts." },
    { label: "Write a template", href: "/dashboard/templates", icon: FileText, body: "Reusable, personalized copy." },
    { label: "Launch a campaign", href: "/dashboard/campaigns", icon: Rocket, body: "Sequence steps across channels." },
    { label: "Run the agent", href: "/dashboard/agent", icon: Bot, body: "Let AI send for you, safely." },
  ];

  return (
    <>
      <DashHeader title="Overview" subtitle="Your outreach at a glance." />
      <div className="p-8">
        {err && <p className="mb-4 text-sm text-red-600">Couldn&apos;t load stats: {err}</p>}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {tiles.map((t) => (
            <Panel key={t.label}>
              <t.icon className="mb-3 h-5 w-5 text-ink-soft" />
              <div className="font-display text-3xl font-extrabold">{t.value ?? "—"}</div>
              <div className="font-mono text-xs uppercase tracking-wide text-ink-soft">{t.label}</div>
            </Panel>
          ))}
        </div>

        <h2 className="font-display mt-10 mb-4 text-lg font-bold">Get started</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="group rounded-2xl border border-line bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <s.icon className="h-6 w-6 text-ink" />
              <div className="font-display mt-4 flex items-center gap-1 text-lg font-bold">
                {s.label}
                <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
              <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
