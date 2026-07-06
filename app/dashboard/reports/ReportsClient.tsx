"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
} from "recharts";
import { Users, Send, MailOpen, MousePointerClick, Reply, TrendingUp } from "lucide-react";
import { DashHeader, Panel } from "@/components/dashboard/ui";

type Report = {
  days: number;
  totals: { leads: number; sent: number; opened: number; clicked: number; replied: number; suppressed: number };
  rates: { open: number; click: number; reply: number };
  funnel: { stage: string; count: number }[];
  series: { date: string; sent: number; opened: number; clicked: number; replied: number }[];
  byCampaign: { id: string; name: string; enrolled: number; sent: number; opened: number; replied: number }[];
};

const COLORS = { sent: "#0a0a0a", opened: "#4f46e5", clicked: "#0891b2", replied: "#059669" };
const STAGE_ORDER = ["new", "contacted", "replied", "qualified", "won", "lost"];

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Panel className="!p-5">
      <div className="flex items-center gap-2 text-ink-soft">{icon}<span className="font-mono text-xs uppercase tracking-wide">{label}</span></div>
      <div className="mt-2 font-display text-3xl font-extrabold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </Panel>
  );
}

const shortDate = (d: string) => d.slice(5); // MM-DD

export default function ReportsClient() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useSWR<Report>(`/api/reports?days=${days}`);

  const t = data?.totals;
  const funnel = (data?.funnel ?? []).slice().sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <>
      <DashHeader
        title="Reports"
        subtitle="Outreach performance across your workspace."
        action={
          <div className="flex gap-1 rounded-xl border border-line p-1">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${days === d ? "bg-ink text-white" : "text-ink-soft hover:bg-tint"}`}>
                {d}d
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-6 p-8">
        {/* Tiles */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile icon={<Users className="h-4 w-4" />} label="Leads" value={(t?.leads ?? 0).toLocaleString()} />
          <Tile icon={<Send className="h-4 w-4" />} label="Sent" value={(t?.sent ?? 0).toLocaleString()} sub={`last ${days} days`} />
          <Tile icon={<MailOpen className="h-4 w-4" />} label="Open rate" value={`${data?.rates.open ?? 0}%`} sub={`${(t?.opened ?? 0).toLocaleString()} opened`} />
          <Tile icon={<Reply className="h-4 w-4" />} label="Reply rate" value={`${data?.rates.reply ?? 0}%`} sub={`${(t?.replied ?? 0).toLocaleString()} replied`} />
        </div>

        {/* Engagement over time */}
        <Panel>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ink-soft" />
            <h2 className="font-display text-base font-bold">Engagement over time</h2>
          </div>
          {isLoading ? (
            <div className="grid h-64 place-items-center text-sm text-ink-soft">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data?.series ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  {Object.entries(COLORS).map(([k, c]) => (
                    <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#6b6b6b" }} interval="preserveStartEnd" minTickGap={28} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b6b6b" }} width={40} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="sent" stroke={COLORS.sent} fill="url(#g-sent)" strokeWidth={2} />
                <Area type="monotone" dataKey="opened" stroke={COLORS.opened} fill="url(#g-opened)" strokeWidth={2} />
                <Area type="monotone" dataKey="clicked" stroke={COLORS.clicked} fill="url(#g-clicked)" strokeWidth={2} />
                <Area type="monotone" dataKey="replied" stroke={COLORS.replied} fill="url(#g-replied)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Funnel */}
          <Panel>
            <h2 className="mb-4 font-display text-base font-bold">Lead funnel</h2>
            <div className="space-y-2.5">
              {funnel.length === 0 && <p className="text-sm text-ink-soft">No leads yet.</p>}
              {funnel.map((f) => (
                <div key={f.stage}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium capitalize">{f.stage}</span>
                    <span className="font-mono text-ink-soft">{f.count.toLocaleString()}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-tint">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* By campaign */}
          <Panel>
            <h2 className="mb-4 font-display text-base font-bold">By campaign (sent vs replied)</h2>
            {(data?.byCampaign ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">No campaigns yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={(data?.byCampaign ?? []).slice(0, 6)} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b6b6b" }} tickFormatter={(n: string) => (n.length > 10 ? n.slice(0, 10) + "…" : n)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b6b6b" }} width={40} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sent" fill={COLORS.sent} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="replied" fill={COLORS.replied} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        {/* Rate strip */}
        <Panel className="!p-5">
          <div className="grid grid-cols-3 divide-x divide-line text-center">
            {[
              { label: "Open rate", value: data?.rates.open ?? 0, icon: <MailOpen className="h-4 w-4" /> },
              { label: "Click rate", value: data?.rates.click ?? 0, icon: <MousePointerClick className="h-4 w-4" /> },
              { label: "Reply rate", value: data?.rates.reply ?? 0, icon: <Reply className="h-4 w-4" /> },
            ].map((r) => (
              <div key={r.label} className="px-4">
                <div className="flex items-center justify-center gap-1.5 text-ink-soft">{r.icon}<span className="font-mono text-xs uppercase">{r.label}</span></div>
                <div className="mt-1 font-display text-2xl font-bold">{r.value}%</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
