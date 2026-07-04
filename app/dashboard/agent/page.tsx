"use client";

import { useEffect, useState } from "react";
import { Bot, Play } from "lucide-react";
import { api } from "@/lib/client";
import { DashHeader, Panel, Banner, Textarea, Label } from "@/components/dashboard/ui";

type Lead = { id: string; firstName: string | null; email: string; company: string | null };

export default function AgentPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [brief, setBrief] = useState("Introduce LeadsKonnect warmly in 3 sentences and ask for a quick call.");
  const [result, setResult] = useState<{ ok: boolean; summary: string; steps: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Lead[]>("/api/leads?take=200").then((l) => {
      setLeads(l);
      setSelected(new Set(l.map((x) => x.id)));
    }).catch((e) => setMsg((e as Error).message));
  }, []);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function run() {
    const leadIds = [...selected];
    if (leadIds.length === 0) return setMsg("Select at least one lead.");
    if (!confirm(`Run the agent on ${leadIds.length} lead(s)? It may send REAL messages.`)) return;
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const res = await api<{ ok: boolean; summary: string; steps: number }>("/api/agent", {
        body: { leadIds, brief },
        method: "POST",
      });
      setResult(res);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DashHeader title="AI Agent" subtitle="Give it a brief; it personalizes and sends across channels — within your limits." />
      <div className="grid gap-6 p-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <h2 className="font-display text-lg font-bold">Campaign brief</h2>
            </div>
            <div className="mt-4">
              <Label>What should the agent say?</Label>
              <Textarea rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={run} disabled={busy} className="btn btn-primary disabled:opacity-50">
                <Play className="h-4 w-4" /> {busy ? "Running…" : "Run agent"}
              </button>
              <span className="font-mono text-xs text-ink-soft">{selected.size} lead(s) selected</span>
            </div>
          </Panel>

          <Banner kind="info">
            The agent sends <strong>real messages</strong> through the same rate-limited path. Email must be
            configured; it prefers email and only uses other channels when they&apos;re set up.
          </Banner>

          {msg && <Banner kind="error">{msg}</Banner>}
          {result && (
            <Panel>
              <h3 className="font-display text-lg font-bold">Result</h3>
              <div className="mt-2 font-mono text-xs text-ink-soft">{result.steps} step(s)</div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{result.summary}</p>
            </Panel>
          )}
        </div>

        {/* Lead picker */}
        <Panel className="h-fit">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Leads</h2>
            <button
              onClick={() => setSelected(selected.size === leads.length ? new Set() : new Set(leads.map((l) => l.id)))}
              className="font-mono text-xs text-ink-soft underline hover:text-ink"
            >
              {selected.size === leads.length ? "Clear" : "Select all"}
            </button>
          </div>
          <div className="max-h-[420px] space-y-1 overflow-y-auto">
            {leads.length === 0 ? (
              <p className="text-sm text-ink-soft">No leads. Add some first.</p>
            ) : (
              leads.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-tint">
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="accent-black" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {l.firstName ?? l.email} <span className="text-ink-soft">· {l.company ?? l.email}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
