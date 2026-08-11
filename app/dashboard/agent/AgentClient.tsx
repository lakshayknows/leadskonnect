"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Bot, Play, FileEdit, Check, X } from "lucide-react";
import { api } from "@/lib/client";
import { Banner, DashHeader, Label, Panel, Select, Textarea, useConfirm, useToast } from "@/components/ui";

type Lead = { id: string; firstName: string | null; email: string; company: string | null };
type Draft = {
  id: string;
  channel: string;
  renderedSubject: string | null;
  renderedBody: string | null;
  lead: { id: string; firstName: string | null; lastName: string | null; email: string | null };
};

const CONFIDENCE_PRESETS = [
  { value: 0.9, label: "Conservative — draft unless very sure" },
  { value: 0.7, label: "Balanced" },
  { value: 0.4, label: "Autonomous — send unless clearly wrong" },
];

export default function AgentPage() {
  const { data: leadsData } = useSWR<{ items: Lead[] }>("/api/leads?pageSize=200");
  const { data: accounts = [] } = useSWR<Array<{ id: string; name: string; email: string }>>("/api/sending-accounts");
  const { data: drafts = [], mutate: mutateDrafts } = useSWR<Draft[]>("/api/agent/drafts");
  const leads = leadsData?.items ?? [];
  const confirm = useConfirm();
  const toast = useToast();

  const [selectedAccount, setSelectedAccount] = useState("default");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionInit, setSelectionInit] = useState(false);
  const [brief, setBrief] = useState("Introduce Followthroo warmly in 3 sentences and ask for a quick call.");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [result, setResult] = useState<{ ok: boolean; summary: string; steps: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState<string | null>(null);

  // Select all leads once, when they first load.
  useEffect(() => {
    if (leadsData?.items && !selectionInit) {
      setSelected(new Set(leadsData.items.map((x) => x.id)));
      setSelectionInit(true);
    }
  }, [leadsData, selectionInit]);

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
    const ok = await confirm({
      title: `Run the agent on ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}?`,
      body: "The agent sends real messages on your connected channels. This can't be undone.",
      confirmLabel: "Run agent",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const res = await api<{ ok: boolean; summary: string; steps: number }>("/api/agent", {
        body: {
          leadIds,
          brief,
          confidenceThreshold,
          sendingAccountId: selectedAccount === "default" ? undefined : selectedAccount,
        },
        method: "POST",
      });
      setResult(res);
      await mutateDrafts();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveDraft(id: string, action: "approve" | "discard") {
    setDraftBusy(id);
    try {
      await api("/api/agent/drafts", { method: "PATCH", body: { messageId: id, action } });
      await mutateDrafts();
      toast(action === "approve" ? "Sent." : "Discarded.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setDraftBusy(null);
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
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_240px]">
              <div>
                <Label>What should the agent say?</Label>
                <Textarea rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} />
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Send From (SMTP Account)</Label>
                  <Select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                    <option value="default">Default SMTP (Server Config)</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.email})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Autonomy</Label>
                  <Select value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(Number(e.target.value))}>
                    {CONFIDENCE_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </Select>
                </div>
                <p className="text-xs text-ink-soft">
                  Select a specific verified SMTP sender for emails sent by this Agent execution.
                </p>
              </div>
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

          {/* Confidence-gated drafts (product PRD §7) — the agent wrote these but wasn't
              sure enough to send unattended. */}
          {drafts.length > 0 && (
            <Panel>
              <div className="mb-3 flex items-center gap-2">
                <FileEdit className="h-4 w-4" />
                <h3 className="font-display text-lg font-bold">Drafts awaiting approval</h3>
                <span className="font-mono text-xs text-ink-soft">{drafts.length}</span>
              </div>
              <div className="space-y-3">
                {drafts.map((d) => (
                  <div key={d.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {[d.lead.firstName, d.lead.lastName].filter(Boolean).join(" ") || d.lead.email || "Unnamed lead"}
                        </div>
                        <div className="text-xs uppercase tracking-wide text-ink-soft">{d.channel}</div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => resolveDraft(d.id, "approve")}
                          disabled={draftBusy === d.id}
                          className="rounded-lg bg-ink p-1.5 text-ink-invert hover:opacity-90 disabled:opacity-50"
                          title="Approve & send"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => resolveDraft(d.id, "discard")}
                          disabled={draftBusy === d.id}
                          className="rounded-lg border border-line p-1.5 text-ink-soft hover:bg-tint hover:text-danger disabled:opacity-50"
                          title="Discard"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {d.renderedSubject && <div className="mt-2 text-xs font-medium text-ink-soft">{d.renderedSubject}</div>}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{d.renderedBody}</p>
                  </div>
                ))}
              </div>
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
