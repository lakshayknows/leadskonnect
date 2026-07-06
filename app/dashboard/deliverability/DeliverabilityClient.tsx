"use client";

import { useState } from "react";
import useSWR from "swr";
import { ShieldCheck, Inbox, AlertTriangle, Flame, Play, LifeBuoy } from "lucide-react";
import { api } from "@/lib/client";
import { DashHeader, Panel, Banner } from "@/components/dashboard/ui";

type Mailbox = {
  id: string; name: string; email: string; provider: string;
  warmupEnabled: boolean; dailyTarget: number;
  score: number | null; sent: number; received: number; inbox: number; spam: number; rescued: number;
};
type Data = {
  days: number;
  overall: { score: number | null; inbox: number; spam: number; sent: number; received: number };
  mailboxes: Mailbox[];
};

function scoreColor(s: number | null) {
  if (s === null) return "text-ink-soft";
  if (s >= 90) return "text-emerald-600";
  if (s >= 70) return "text-amber-600";
  return "text-red-600";
}

export default function DeliverabilityClient() {
  const { data, mutate } = useSWR<Data>("/api/deliverability?days=30");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);

  const o = data?.overall;
  const placementTotal = (o?.inbox ?? 0) + (o?.spam ?? 0);

  async function toggleWarmup(m: Mailbox, enabled: boolean) {
    await api("/api/warmup", { method: "PATCH", body: { sendingAccountId: m.id, enabled } });
    mutate();
  }
  async function setTarget(m: Mailbox, dailyTarget: number) {
    await api("/api/warmup", { method: "PATCH", body: { sendingAccountId: m.id, dailyTarget } });
    mutate();
  }
  async function runNow() {
    setBusy(true); setMsg(null);
    try {
      const res = await api<{ mailboxes: number; sent: number; skipped?: string }>("/api/warmup/run", { method: "POST", body: {} });
      setMsg(res.skipped ? { kind: "info", text: res.skipped } : { kind: "success", text: `Warm-up sent ${res.sent} email(s) across ${res.mailboxes} mailboxes.` });
      mutate();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <>
      <DashHeader
        title="Deliverability"
        subtitle="Warm up mailboxes and keep your emails out of spam."
        action={
          <button onClick={runNow} disabled={busy} className="btn btn-primary !py-2 !text-sm disabled:opacity-50">
            <Play className="h-4 w-4" /> {busy ? "Running…" : "Run warm-up now"}
          </button>
        }
      />

      <div className="space-y-6 p-8">
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

        {(data?.mailboxes.length ?? 0) === 0 && (
          <Banner kind="info">Connect a sending account to start warming it up. Two or more mailboxes warm each other.</Banner>
        )}

        {/* Overall tiles */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Panel className="!p-5">
            <div className="flex items-center gap-2 text-ink-soft"><ShieldCheck className="h-4 w-4" /><span className="font-mono text-xs uppercase">Deliverability</span></div>
            <div className={`mt-2 font-display text-3xl font-extrabold ${scoreColor(o?.score ?? null)}`}>{o?.score ?? "—"}{o?.score != null && <span className="text-lg">/100</span>}</div>
            <div className="mt-0.5 text-xs text-ink-soft">mean across mailboxes</div>
          </Panel>
          <Panel className="!p-5">
            <div className="flex items-center gap-2 text-ink-soft"><Inbox className="h-4 w-4" /><span className="font-mono text-xs uppercase">Inbox</span></div>
            <div className="mt-2 font-display text-3xl font-extrabold">{o?.inbox ?? 0}</div>
            <div className="mt-0.5 text-xs text-ink-soft">warm-up landed in inbox</div>
          </Panel>
          <Panel className="!p-5">
            <div className="flex items-center gap-2 text-ink-soft"><AlertTriangle className="h-4 w-4" /><span className="font-mono text-xs uppercase">Spam</span></div>
            <div className="mt-2 font-display text-3xl font-extrabold">{o?.spam ?? 0}</div>
            <div className="mt-0.5 text-xs text-ink-soft">landed in spam (auto-rescued)</div>
          </Panel>
          <Panel className="!p-5">
            <div className="flex items-center gap-2 text-ink-soft"><Flame className="h-4 w-4" /><span className="font-mono text-xs uppercase">Warm-up sent</span></div>
            <div className="mt-2 font-display text-3xl font-extrabold">{o?.sent ?? 0}</div>
            <div className="mt-0.5 text-xs text-ink-soft">last {data?.days ?? 30} days</div>
          </Panel>
        </div>

        {/* Where cold emails land */}
        <Panel>
          <h2 className="mb-3 font-display text-base font-bold">Where your warm-up emails land</h2>
          {placementTotal === 0 ? (
            <p className="text-sm text-ink-soft">No placement data yet. Enable warm-up on ≥2 mailboxes and let a poll cycle run.</p>
          ) : (
            <div className="flex h-4 overflow-hidden rounded-full">
              <div className="bg-emerald-500" style={{ width: `${((o!.inbox) / placementTotal) * 100}%` }} title={`Inbox ${o!.inbox}`} />
              <div className="bg-red-400" style={{ width: `${((o!.spam) / placementTotal) * 100}%` }} title={`Spam ${o!.spam}`} />
            </div>
          )}
          {placementTotal > 0 && (
            <div className="mt-2 flex gap-4 text-xs text-ink-soft">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Inbox {Math.round((o!.inbox / placementTotal) * 100)}%</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Spam {Math.round((o!.spam / placementTotal) * 100)}%</span>
            </div>
          )}
        </Panel>

        {/* Per-mailbox */}
        <Panel>
          <h2 className="mb-4 font-display text-base font-bold">Mailboxes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-xs uppercase tracking-wide text-ink-soft">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4">Mailbox</th>
                  <th className="px-3 py-2">Warm-up</th>
                  <th className="px-3 py-2">Target/day</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Inbox</th>
                  <th className="px-3 py-2">Spam</th>
                  <th className="px-3 py-2">Rescued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(data?.mailboxes ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-ink-soft">{m.email} · {m.provider === "gmail_oauth" ? "Gmail" : "SMTP"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => toggleWarmup(m, !m.warmupEnabled)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${m.warmupEnabled ? "bg-emerald-500" : "bg-line"}`}
                        aria-label="Toggle warm-up"
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${m.warmupEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number" min={1} max={50} defaultValue={m.dailyTarget}
                        onBlur={(e) => { const v = Number(e.target.value); if (v && v !== m.dailyTarget) setTarget(m, v); }}
                        className="w-16 rounded-lg border border-line px-2 py-1 text-center font-mono text-xs outline-none focus:border-ink"
                      />
                    </td>
                    <td className={`px-3 py-3 font-display text-lg font-bold ${scoreColor(m.score)}`}>{m.score ?? "—"}</td>
                    <td className="px-3 py-3">{m.inbox}</td>
                    <td className="px-3 py-3">{m.spam}</td>
                    <td className="px-3 py-3">{m.rescued > 0 ? <span className="flex items-center gap-1 text-emerald-600"><LifeBuoy className="h-3.5 w-3.5" />{m.rescued}</span> : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-ink-soft">
            Gmail mailboxes connected before the deliverability update must reconnect to grant read access (used for placement detection + spam rescue).
          </p>
        </Panel>
      </div>
    </>
  );
}
