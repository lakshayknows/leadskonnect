"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Plus, X, Rocket, Mail, Link as LinkIcon, MessageSquare, Clock, ArrowDown,
  Sparkles, Server, GitBranch, LayoutTemplate, PenLine, Trash2, Users, StopCircle, Pencil, Square,
} from "lucide-react";
import { api } from "@/lib/client";
import { DashHeader, Panel, Banner, Input, Select, Label } from "@/components/dashboard/ui";

type Template = { id: string; channel: string; name: string };
type SendingAccount = { id: string; name: string; email: string };
type Segment = { id: string; name: string; count: number };
type Campaign = {
  id: string;
  name: string;
  status: string;
  sequence: unknown;
  sendingAccountId: string | null;
  sendingAccount?: SendingAccount | null;
  _count?: { enrollments: number };
};

// Builder node shapes (UI). Converted to the engine graph on save.
type SendNode = { type: "send"; channel: string; templateId: string; waitDays: number };
type CondNode = { type: "condition"; on: "replied" | "opened" | "clicked"; yes: "stop" | "continue"; no: "stop" | "continue" };
type BuilderNode = SendNode | CondNode;

const newSend = (waitDays = 0): SendNode => ({ type: "send", channel: "email", templateId: "", waitDays });
const newCond = (): CondNode => ({ type: "condition", on: "replied", yes: "stop", no: "continue" });

const PRESETS: { name: string; blurb: string; nodes: BuilderNode[] }[] = [
  { name: "3-step email drip", blurb: "Three emails, spaced a few days apart.", nodes: [newSend(0), newSend(3), newSend(5)] },
  { name: "Stop on reply", blurb: "Email, then only follow up if they didn't reply.", nodes: [newSend(0), { type: "condition", on: "replied", yes: "stop", no: "continue" }, newSend(4)] },
  { name: "Multichannel touch", blurb: "Email → LinkedIn → WhatsApp over a week.", nodes: [newSend(0), { type: "send", channel: "linkedin", templateId: "", waitDays: 2 }, { type: "send", channel: "whatsapp", templateId: "", waitDays: 3 }] },
];

// Turn the linear builder list into the engine's node graph.
function toGraph(nodes: BuilderNode[]) {
  const out = nodes.map((n, i) => {
    const id = `n${i}`;
    const nextId = i < nodes.length - 1 ? `n${i + 1}` : null;
    if (n.type === "send") return { id, type: "send", channel: n.channel, templateId: n.templateId || undefined, waitDays: Number(n.waitDays) || 0, next: nextId };
    return { id, type: "condition", on: n.on, onYes: n.yes === "continue" ? nextId : null, onNo: n.no === "continue" ? nextId : null };
  });
  return { nodes: out, startNodeId: nodes.length ? "n0" : null };
}

// Convert a stored graph back into the flat builder node list for editing.
function fromGraph(seq: unknown): BuilderNode[] {
  if (Array.isArray(seq)) {
    return seq.map((s) => ({ type: "send", channel: s.channel ?? "email", templateId: s.templateId ?? "", waitDays: s.waitDays ?? 0 } as SendNode));
  }
  const g = seq as { nodes?: { type: string; channel?: string; templateId?: string; waitDays?: number; on?: string; onYes?: string | null; onNo?: string | null }[] };
  if (!g?.nodes) return [newSend(0)];
  return g.nodes.map((n) => {
    if (n.type === "condition") {
      return { type: "condition", on: (n.on ?? "replied") as CondNode["on"], yes: n.onYes ? "continue" : "stop", no: n.onNo ? "continue" : "stop" } as CondNode;
    }
    return { type: "send", channel: n.channel ?? "email", templateId: n.templateId ?? "", waitDays: n.waitDays ?? 0 } as SendNode;
  });
}

// Extract a flat display list from a stored sequence (graph or legacy array).
function displayNodes(seq: unknown): { kind: string; channel?: string; waitDays?: number; on?: string }[] {
  if (Array.isArray(seq)) return seq.map((s) => ({ kind: "send", channel: s.channel, waitDays: s.waitDays }));
  const g = seq as { nodes?: { type: string; channel?: string; waitDays?: number; on?: string }[] };
  if (g?.nodes) return g.nodes.map((n) => ({ kind: n.type, channel: n.channel, waitDays: n.waitDays, on: n.on }));
  return [];
}

const channelIcon = (channel?: string) => {
  switch (channel) {
    case "email": return <Mail className="h-5 w-5 text-indigo-600" />;
    case "linkedin": return <LinkIcon className="h-5 w-5 text-sky-600" />;
    case "whatsapp": return <MessageSquare className="h-5 w-5 text-emerald-600" />;
    default: return <Sparkles className="h-5 w-5 text-amber-500" />;
  }
};

export default function CampaignsPage() {
  const { data: campaigns = [], mutate: mutateCampaigns } = useSWR<Campaign[]>("/api/campaigns");
  const { data: templates = [] } = useSWR<Template[]>("/api/templates");
  const { data: sendingAccounts = [] } = useSWR<SendingAccount[]>("/api/sending-accounts");
  const { data: segments = [] } = useSWR<Segment[]>("/api/segments");

  const [mode, setMode] = useState<"list" | "choose" | "build">("list");
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("default");
  const [nodes, setNodes] = useState<BuilderNode[]>([newSend(0)]);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [launchFor, setLaunchFor] = useState<Campaign | null>(null);

  function patchNode(i: number, patch: Partial<SendNode> & Partial<CondNode>) {
    setNodes((ns) => ns.map((n, idx) => (idx === i ? ({ ...n, ...patch } as BuilderNode) : n)));
  }

  function startManual() { setEditingCampaign(null); setNodes([newSend(0)]); setName(""); setSelectedAccount("default"); setMode("build"); }
  function startFromPreset(p: (typeof PRESETS)[number]) {
    setEditingCampaign(null); setNodes(p.nodes.map((n) => ({ ...n }))); setName(p.name); setSelectedAccount("default"); setMode("build");
  }
  function startEdit(c: Campaign) {
    setEditingCampaign(c);
    setName(c.name);
    setSelectedAccount(c.sendingAccountId ?? "default");
    setNodes(fromGraph(c.sequence));
    setMsg(null);
    setMode("build");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setMsg({ kind: "error", text: "Campaign name is required." });
    setBusy(true); setMsg(null);
    try {
      const body = { name, sequence: toGraph(nodes), sendingAccountId: selectedAccount === "default" ? null : selectedAccount };
      if (editingCampaign) {
        await api(`/api/campaigns/${editingCampaign.id}`, { method: "PATCH", body });
        setMsg({ kind: "success", text: "Campaign updated." });
      } else {
        await api("/api/campaigns", { body });
        setMsg({ kind: "success", text: "Campaign created." });
      }
      setMode("list");
      setEditingCampaign(null);
      mutateCampaigns();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally { setBusy(false); }
  }

  async function launch(target: { segmentId?: string; allLeads?: boolean }) {
    if (!launchFor) return;
    setMsg(null);
    try {
      let res: { enrolled: number; skipped: number; enqueued: number; queueAvailable: boolean };
      if (target.segmentId) {
        res = await api(`/api/campaigns/${launchFor.id}/enroll`, { body: { segmentId: target.segmentId } });
      } else {
        // "All leads" — fetch up to 500 and enroll
        const { items: leads } = await api<{ items: { id: string }[] }>("/api/leads?pageSize=500");
        if (leads.length === 0) { setMsg({ kind: "error", text: "No leads to launch to." }); setLaunchFor(null); return; }
        res = await api(`/api/campaigns/${launchFor.id}/enroll`, { body: { leadIds: leads.map((l) => l.id) } });
      }
      setMsg({
        kind: res.queueAvailable ? "success" : "info",
        text: `Enrolled ${res.enrolled} lead(s)${res.skipped ? `, skipped ${res.skipped} already enrolled` : ""}. ${
          res.queueAvailable ? "Sequence is running." : "Queue unavailable — set REDIS_URL/QStash or use dev inline."
        }`,
      });
      setLaunchFor(null);
      mutateCampaigns();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
      setLaunchFor(null);
    }
  }

  async function stopCampaign(c: Campaign) {
    if (!confirm(`Stop campaign "${c.name}"? Active enrollments will not receive further messages.`)) return;
    try {
      await api(`/api/campaigns/${c.id}`, { method: "PATCH", body: { status: "done" } });
      mutateCampaigns();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  async function reactivateCampaign(c: Campaign) {
    try {
      await api(`/api/campaigns/${c.id}`, { method: "PATCH", body: { status: "active" } });
      mutateCampaigns();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  return (
    <>
      <DashHeader
        title="Campaigns"
        subtitle="Design conditional outreach sequences, then enroll a group or individual leads."
        action={mode === "list" && (
          <button onClick={() => setMode("choose")} className="btn btn-primary flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New Campaign
          </button>
        )}
      />

      <div className="p-8">
        {msg && <div className="mb-6"><Banner kind={msg.kind}>{msg.text}</Banner></div>}

        {/* ---- Two-path chooser ---- */}
        {mode === "choose" && (
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">How do you want to start?</h2>
              <button onClick={() => setMode("list")} className="rounded-lg p-1.5 text-ink-soft hover:bg-tint hover:text-ink"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Panel className="flex flex-col">
                <LayoutTemplate className="h-8 w-8 text-indigo-600" />
                <h3 className="mt-4 font-display text-lg font-bold">Start with a template</h3>
                <p className="mt-1 text-sm text-ink-soft">Ready-made sequences you can tweak.</p>
                <div className="mt-4 space-y-2">
                  {PRESETS.map((p) => (
                    <button key={p.name} onClick={() => startFromPreset(p)} className="w-full rounded-xl border border-line px-4 py-3 text-left transition hover:border-ink hover:bg-tint">
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-ink-soft">{p.blurb}</div>
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel className="flex flex-col">
                <PenLine className="h-8 w-8 text-emerald-600" />
                <h3 className="mt-4 font-display text-lg font-bold">Create manually</h3>
                <p className="mt-1 text-sm text-ink-soft">Build steps and conditional branches from scratch.</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-soft">
                  <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> Multi-channel steps with wait times</li>
                  <li className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> Branch on reply / open / click</li>
                  <li className="flex items-center gap-2"><Users className="h-4 w-4" /> Enroll a group or a single lead</li>
                </ul>
                <button onClick={startManual} className="btn btn-primary mt-4 justify-center">Create manual campaign</button>
              </Panel>
            </div>
          </div>
        )}

        {/* ---- Builder ---- */}
        {mode === "build" && (
          <Panel className="border-line/70">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <h2 className="font-display text-xl font-bold">{editingCampaign ? `Edit: ${editingCampaign.name}` : "Sequence builder"}</h2>
                <p className="text-xs text-ink-soft">Steps run top to bottom. A reply halts the sequence unless a condition says otherwise.</p>
              </div>
              <button onClick={() => { setMode("list"); setEditingCampaign(null); }} className="rounded-lg p-1.5 text-ink-soft hover:bg-tint hover:text-ink"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
              <div className="flex flex-col items-center rounded-2xl border border-line/40 bg-canvas px-4 py-8">
                <div className="w-full max-w-[460px]">
                  <div className="flex items-center justify-center gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-5 py-3 text-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <div className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-950">Trigger: Enroll lead</div>
                  </div>
                  <Connector />

                  {nodes.map((n, i) => (
                    <div key={i} className="w-full">
                      <div className="relative rounded-2xl border border-line bg-white p-5 shadow-sm">
                        <div className="absolute -left-3 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-xs font-bold text-white">{i + 1}</div>
                        <div className="pl-4">
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {n.type === "send" ? channelIcon(n.channel) : <GitBranch className="h-5 w-5 text-amber-600" />}
                              <span className="font-display text-xs font-bold uppercase tracking-wide">
                                {n.type === "send" ? `${n.channel} message` : "Condition"}
                              </span>
                            </div>
                            <button type="button" onClick={() => setNodes((ns) => ns.filter((_, idx) => idx !== i))} className="rounded p-1 text-ink-soft transition hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {n.type === "send" ? (
                            <div className="grid gap-3">
                              <div className="flex items-center gap-2 rounded-xl border border-line/60 bg-canvas px-3 py-1.5">
                                <Clock className="h-4 w-4 text-ink-soft" />
                                <span className="text-xs text-ink-soft">Wait</span>
                                <input type="number" min={0} value={n.waitDays} onChange={(e) => patchNode(i, { waitDays: Number(e.target.value) })} className="w-16 rounded border border-line bg-white px-2 py-0.5 text-center font-mono text-xs outline-none focus:border-ink" />
                                <span className="text-xs text-ink-soft">days, then send</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label>Channel</Label>
                                  <Select value={n.channel} onChange={(e) => patchNode(i, { channel: e.target.value, templateId: "" })}>
                                    <option value="email">Email</option>
                                    <option value="linkedin">LinkedIn</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="social">Social</option>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Template</Label>
                                  <Select value={n.templateId} onChange={(e) => patchNode(i, { templateId: e.target.value })}>
                                    <option value="">No template</option>
                                    {templates.filter((t) => t.channel === n.channel).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid gap-3">
                              <div>
                                <Label>If the lead has</Label>
                                <Select value={n.on} onChange={(e) => patchNode(i, { on: e.target.value as CondNode["on"] })}>
                                  <option value="replied">Replied</option>
                                  <option value="opened">Opened (needs tracking)</option>
                                  <option value="clicked">Clicked (needs tracking)</option>
                                </Select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label>Then (yes)</Label>
                                  <Select value={n.yes} onChange={(e) => patchNode(i, { yes: e.target.value as "stop" | "continue" })}>
                                    <option value="stop">Stop sequence</option>
                                    <option value="continue">Continue</option>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Else (no)</Label>
                                  <Select value={n.no} onChange={(e) => patchNode(i, { no: e.target.value as "stop" | "continue" })}>
                                    <option value="continue">Continue</option>
                                    <option value="stop">Stop sequence</option>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Connector />
                    </div>
                  ))}

                  <div className="flex items-center justify-center gap-2">
                    <button type="button" onClick={() => setNodes((ns) => [...ns, newSend(2)])} className="flex items-center gap-1 rounded-full border-2 border-dashed border-ink-soft bg-white px-3 py-2 text-xs font-medium text-ink-soft transition hover:border-ink hover:text-ink">
                      <Plus className="h-4 w-4" /> Message
                    </button>
                    <button type="button" onClick={() => setNodes((ns) => [...ns, newCond()])} className="flex items-center gap-1 rounded-full border-2 border-dashed border-amber-400 bg-white px-3 py-2 text-xs font-medium text-amber-700 transition hover:border-amber-600">
                      <GitBranch className="h-4 w-4" /> Condition
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Panel className="border-line/60">
                  <h3 className="font-display text-lg font-bold">Campaign info</h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <Label>Campaign title *</Label>
                      <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 Sales Follow-up" />
                    </div>
                    <div>
                      <Label>Send from</Label>
                      <Select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                        <option value="default">Default (server settings)</option>
                        {sendingAccounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name} ({acc.email})</option>)}
                      </Select>
                    </div>
                  </div>
                </Panel>
                <div className="flex gap-2">
                  <button onClick={() => { setMode("list"); setEditingCampaign(null); }} className="flex-1 rounded-xl border border-line bg-white py-3 text-sm font-semibold transition hover:bg-tint">Cancel</button>
                  <button onClick={save} disabled={busy} className="btn btn-primary flex-1 justify-center py-3 text-sm font-semibold disabled:opacity-50">{editingCampaign ? "Update campaign" : "Save campaign"}</button>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* ---- List ---- */}
        {mode === "list" && (
          campaigns.length === 0 ? (
            <Panel>
              <div className="py-10 text-center">
                <Rocket className="mx-auto h-12 w-12 text-ink-soft/40" />
                <h3 className="mt-4 text-base font-bold">No campaigns yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">Design a conditional sequence and enroll a group or individual leads.</p>
                <button onClick={() => setMode("choose")} className="btn btn-primary mt-6 inline-flex">Create your first campaign</button>
              </div>
            </Panel>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {campaigns.map((c) => {
                const dn = displayNodes(c.sequence);
                return (
                  <Panel key={c.id} className="flex flex-col justify-between border-line/70 transition hover:border-ink/50">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display text-lg font-bold">{c.name}</h3>
                        <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${c.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-800"}`}>{c.status}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-line/40 bg-canvas p-3">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 font-mono text-[10px] font-bold text-white" title="Start">S</span>
                        {dn.map((s, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div className="h-0.5 w-3 bg-line" />
                            <div className="flex items-center gap-1 rounded border border-line bg-white px-2 py-1 font-mono text-[10px] font-medium">
                              {s.kind === "condition" ? <><GitBranch className="h-3.5 w-3.5 text-amber-600" /><span>{s.on}?</span></> : s.kind === "exit" ? <><StopCircle className="h-3.5 w-3.5" /><span>exit</span></> : <>{channelIcon(s.channel)}<span>{s.channel}</span>{(s.waitDays ?? 0) > 0 && <span className="ml-0.5 font-bold text-indigo-600">+{s.waitDays}d</span>}</>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {c.sendingAccount && (
                        <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-soft">
                          <Server className="h-3.5 w-3.5" /> Sender: <strong className="text-ink">{c.sendingAccount.name}</strong>
                        </div>
                      )}
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                      <span className="text-xs text-ink-soft">{c._count?.enrollments ?? 0} enrolled · {dn.length} node(s)</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(c)} className="flex items-center gap-1 rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold transition hover:bg-tint"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                        {c.status === "done" ? (
                          <button onClick={() => reactivateCampaign(c)} className="flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"><Rocket className="h-3.5 w-3.5" /> Reactivate</button>
                        ) : (
                          <>
                            {c.status === "active" && (
                              <button onClick={() => stopCampaign(c)} className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"><Square className="h-3.5 w-3.5" /> Stop</button>
                            )}
                            <button onClick={() => setLaunchFor(c)} className="btn btn-primary !py-2 !text-xs flex items-center gap-1"><Rocket className="h-3.5 w-3.5" /> Launch</button>
                          </>
                        )}
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ---- Launch / enroll modal ---- */}
      {launchFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setLaunchFor(null)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold">Launch “{launchFor.name}”</h3>
            <p className="mt-1 text-sm text-ink-soft">Choose who to enroll into this sequence.</p>
            <div className="mt-5 space-y-2">
              {/* Groups first — safer, explicit targeting */}
              {segments.length > 0 ? (
                <>
                  <div className="font-mono text-xs uppercase text-ink-soft">Launch to a group</div>
                  {segments.map((s) => (
                    <button key={s.id} onClick={() => launch({ segmentId: s.id })} className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50">
                      <span className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-indigo-500" />{s.name}</span>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-mono text-xs text-indigo-600">{s.count} leads</span>
                    </button>
                  ))}
                  <div className="pt-2 font-mono text-xs uppercase text-ink-soft">Or enroll everyone</div>
                </>
              ) : (
                <div className="pb-1 font-mono text-xs uppercase text-ink-soft">No groups yet — enroll everyone</div>
              )}
              {/* All leads — demoted, requires confirmation to avoid accidents */}
              <button
                onClick={() => {
                  if (!confirm(`Enroll ALL leads into this campaign? This sends messages to every lead in your list.`)) return;
                  launch({ allLeads: true });
                }}
                className="flex w-full items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left transition hover:border-amber-400 hover:bg-amber-100"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-amber-800"><Users className="h-4 w-4" /> All leads</span>
                <span className="font-mono text-xs text-amber-600">up to 500 · confirm required</span>
              </button>
            </div>
            <button onClick={() => setLaunchFor(null)} className="mt-5 w-full rounded-xl border border-line py-2.5 text-sm font-semibold transition hover:bg-tint">Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

function Connector() {
  return (
    <div className="relative mx-auto my-1 h-8 w-0.5 bg-line">
      <ArrowDown className="absolute -bottom-2 -left-[8px] h-4 w-4 text-line" />
    </div>
  );
}
