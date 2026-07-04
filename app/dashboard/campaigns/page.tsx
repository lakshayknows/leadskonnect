"use client";

import { useEffect, useState } from "react";
import { Plus, X, Rocket, Mail, Link as LinkIcon, MessageSquare, Clock, ArrowDown, Sparkles, Server, Check } from "lucide-react";
import { api } from "@/lib/client";
import { DashHeader, Panel, Banner, Input, Select, Label } from "@/components/dashboard/ui";

type Template = { id: string; channel: string; name: string };
type SendingAccount = { id: string; name: string; email: string };
type Campaign = { 
  id: string; 
  name: string; 
  status: string; 
  sequence: Step[];
  sendingAccountId: string | null;
  sendingAccount?: SendingAccount | null;
};
type Step = { channel: string; templateId?: string; waitDays: number };

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sendingAccounts, setSendingAccounts] = useState<SendingAccount[]>([]);
  
  // Builder state
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("default");
  const [steps, setSteps] = useState<Step[]>([
    { channel: "email", templateId: "", waitDays: 0 }
  ]);

  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api<Campaign[]>("/api/campaigns").then(setCampaigns).catch(() => {});
    api<Template[]>("/api/templates").then(setTemplates).catch(() => {});
    api<SendingAccount[]>("/api/sending-accounts").then(setSendingAccounts).catch(() => {});
  };
  
  useEffect(() => {
    load();
  }, []);

  function setStep(i: number, patch: Partial<Step>) {
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setMsg({ kind: "error", text: "Campaign name is required." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const sequence = steps.map((s) => ({
        channel: s.channel,
        templateId: s.templateId || undefined,
        waitDays: Number(s.waitDays) || 0,
      }));
      await api("/api/campaigns", { 
        body: { 
          name, 
          sequence,
          sendingAccountId: selectedAccount === "default" ? null : selectedAccount
        } 
      });
      setName("");
      setSelectedAccount("default");
      setSteps([{ channel: "email", templateId: "", waitDays: 0 }]);
      setMsg({ kind: "success", text: "Campaign created." });
      setIsCreating(false);
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function launch(id: string) {
    if (!confirm("Launch this campaign? This will queue real messages to all your leads.")) return;
    setMsg(null);
    try {
      const leads = await api<{ id: string }[]>("/api/leads?take=500");
      if (leads.length === 0) {
        setMsg({ kind: "error", text: "No leads to launch to. Add leads first." });
        return;
      }
      const res = await api<{ enqueued: number; queueAvailable: boolean; note?: string }>("/api/campaigns", {
        method: "PUT",
        body: { campaignId: id, leadIds: leads.map((l) => l.id) },
      });
      setMsg({
        kind: res.queueAvailable ? "success" : "info",
        text: `Queued ${res.enqueued} sends.${res.note ? " " + res.note : " The queue will be processed automatically."}`,
      });
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-5 w-5 text-indigo-600" />;
      case "linkedin": return <LinkIcon className="h-5 w-5 text-sky-600" />;
      case "whatsapp": return <MessageSquare className="h-5 w-5 text-emerald-600" />;
      default: return <Sparkles className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <>
      <DashHeader 
        title="Campaigns" 
        subtitle="Design marketing automation paths, schedule follow-ups, and launch outreach sequences." 
        action={
          !isCreating && (
            <button 
              onClick={() => setIsCreating(true)} 
              className="btn btn-primary flex items-center gap-1.5"
            >
              <Plus className="h-4.5 w-4.5" /> New Campaign
            </button>
          )
        }
      />
      
      <div className="p-8">
        {msg && <div className="mb-6"><Banner kind={msg.kind}>{msg.text}</Banner></div>}

        {isCreating ? (
          <div className="space-y-6">
            <Panel className="border-line/70">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold">Visual Flow Designer</h2>
                  <p className="text-xs text-ink-soft">Map your triggers, wait conditions, and channels sequentially.</p>
                </div>
                <button 
                  onClick={() => setIsCreating(false)} 
                  className="rounded-lg p-1.5 text-ink-soft hover:bg-tint hover:text-ink transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
                {/* Visual Canvas flow */}
                <div className="flex flex-col items-center rounded-2xl bg-canvas py-10 px-4 border border-line/40">
                  {/* Start Node */}
                  <div className="flex flex-col items-center w-full max-w-[420px]">
                    <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-5 py-4 shadow-sm w-full text-center justify-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <div className="text-sm font-bold text-emerald-950 uppercase tracking-wider font-mono">Trigger: Launch Sequence</div>
                    </div>
                    <div className="h-8 w-0.5 bg-line my-1 relative">
                      <ArrowDown className="h-4.5 w-4.5 text-line absolute -bottom-2 -left-[8px]" />
                    </div>
                  </div>

                  {/* Flow Nodes */}
                  <div className="w-full max-w-[460px] space-y-2">
                    {steps.map((s, i) => (
                      <div key={i} className="flex flex-col items-center w-full">
                        {/* Node Card */}
                        <div className="relative group w-full rounded-2xl border border-line bg-white p-5 shadow-sm hover:shadow-md transition-all">
                          {/* Step Badge */}
                          <div className="absolute -left-3 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white font-mono text-xs font-bold shadow">
                            {i + 1}
                          </div>

                          <div className="pl-4">
                            <div className="mb-4 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getChannelIcon(s.channel)}
                                <span className="font-display font-bold text-ink uppercase tracking-wide text-xs">
                                  Action: {s.channel} Message
                                </span>
                              </div>
                              {steps.length > 1 && (
                                <button 
                                  type="button" 
                                  onClick={() => setSteps((st) => st.filter((_, idx) => idx !== i))} 
                                  className="rounded p-1 text-ink-soft hover:bg-red-50 hover:text-red-600 transition"
                                >
                                  <Trash2Icon className="h-4 w-4" />
                                </button>
                              )}
                            </div>

                            <div className="grid gap-3">
                              {/* Wait Days settings */}
                              <div className="flex items-center gap-2 rounded-xl bg-canvas border border-line/60 px-3 py-1.5">
                                <Clock className="h-4 w-4 text-ink-soft" />
                                <span className="text-xs text-ink-soft">Wait time:</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={s.waitDays}
                                  onChange={(e) => setStep(i, { waitDays: Number(e.target.value) })}
                                  className="w-16 rounded border border-line bg-white px-2 py-0.5 text-xs text-center font-mono focus:border-ink outline-none"
                                />
                                <span className="text-xs text-ink-soft">days before sending</span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label>Channel</Label>
                                  <Select 
                                    value={s.channel} 
                                    onChange={(e) => setStep(i, { channel: e.target.value, templateId: "" })}
                                  >
                                    <option value="email">Email</option>
                                    <option value="linkedin">LinkedIn</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="social">Social</option>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Outreach Template</Label>
                                  <Select 
                                    value={s.templateId} 
                                    onChange={(e) => setStep(i, { templateId: e.target.value })}
                                  >
                                    <option value="">No template (empty)</option>
                                    {templates.filter((t) => t.channel === s.channel).map((t) => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Visual Connector Line */}
                        <div className="h-8 w-0.5 bg-line my-1 relative">
                          <ArrowDown className="h-4.5 w-4.5 text-line absolute -bottom-2 -left-[8px]" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Step Connector */}
                  <button
                    type="button"
                    onClick={() => setSteps((s) => [...s, { channel: "email", templateId: "", waitDays: 2 }])}
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-ink-soft bg-white text-ink-soft hover:border-ink hover:text-ink hover:scale-105 transition-all shadow-sm"
                    title="Add sequence step"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <span className="mt-2 text-xs font-medium text-ink-soft font-mono">Insert Follow-up Node</span>
                </div>

                {/* Configurations Panel */}
                <div className="space-y-4">
                  <Panel className="border-line/60">
                    <h3 className="font-display font-bold text-lg">Campaign Info</h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label>Campaign Title *</Label>
                        <Input 
                          required 
                          value={name} 
                          onChange={(e) => setName(e.target.value)} 
                          placeholder="e.g. Q3 Sales Follow-up" 
                        />
                      </div>
                      
                      <div>
                        <Label>Send From (SMTP Account)</Label>
                        <Select 
                          value={selectedAccount} 
                          onChange={(e) => setSelectedAccount(e.target.value)}
                        >
                          <option value="default">Default SMTP (Server Settings)</option>
                          {sendingAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.email})
                            </option>
                          ))}
                        </Select>
                        <p className="mt-2 text-[10px] text-ink-soft leading-relaxed">
                          Verified SMTP account to send outreach emails from. Inactive or missing selection uses system fallback.
                        </p>
                      </div>
                    </div>
                  </Panel>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsCreating(false)} 
                      className="flex-1 rounded-xl border border-line bg-white py-3 text-sm font-semibold text-ink transition hover:bg-tint"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={create}
                      disabled={busy} 
                      className="btn btn-primary flex-1 justify-center py-3 text-sm font-semibold disabled:opacity-50"
                    >
                      Save Campaign
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        ) : (
          <div className="space-y-6">
            {campaigns.length === 0 ? (
              <Panel>
                <div className="text-center py-10">
                  <Rocket className="mx-auto h-12 w-12 text-ink-soft/40" />
                  <h3 className="mt-4 text-base font-bold">No active sequences</h3>
                  <p className="mt-1 text-sm text-ink-soft max-w-sm mx-auto">
                    Design a multi-step sequence of automated messages and trigger it to targeted audiences.
                  </p>
                  <button 
                    onClick={() => setIsCreating(true)} 
                    className="btn btn-primary mt-6 inline-flex"
                  >
                    Create Your First Campaign
                  </button>
                </div>
              </Panel>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {campaigns.map((c) => (
                  <Panel key={c.id} className="relative flex flex-col justify-between border-line/70 hover:border-ink/50 transition">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display text-lg font-bold">{c.name}</h3>
                        <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                          c.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-800"
                        }`}>
                          {c.status}
                        </span>
                      </div>

                      {/* Displaying horizontal sequence flowchart */}
                      <div className="mt-4 flex flex-wrap items-center gap-1.5 bg-canvas rounded-xl p-3 border border-line/40">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white font-mono" title="Start">S</span>
                        {(c.sequence ?? []).map((s, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div className="h-0.5 w-3 bg-line" />
                            <div className="flex items-center gap-1 rounded bg-white px-2 py-1 border border-line font-mono text-[10px] font-medium shadow-xs">
                              {getChannelIcon(s.channel)}
                              <span>{s.channel}</span>
                              {s.waitDays > 0 && <span className="text-indigo-600 font-bold ml-0.5">+{s.waitDays}d</span>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {c.sendingAccount && (
                        <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-soft">
                          <Server className="h-3.5 w-3.5" />
                          <span>Sender: <strong className="text-ink">{c.sendingAccount.name}</strong> ({c.sendingAccount.email})</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                      <span className="text-xs text-ink-soft">
                        {c.sequence?.length || 0} sequence node(s)
                      </span>
                      <button 
                        onClick={() => launch(c.id)} 
                        className="btn btn-primary !py-2 !text-xs flex items-center gap-1"
                      >
                        <Rocket className="h-3.5 w-3.5" /> Launch
                      </button>
                    </div>
                  </Panel>
                ))}
              </div>
            )}
            
            <Panel className="border-dashed bg-canvas/30">
              <div className="flex items-start gap-3">
                <Server className="mt-0.5 h-4 w-4 text-ink-soft" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Production Serverless Execution</h4>
                  <p className="text-xs text-ink-soft leading-relaxed max-w-2xl">
                    Outreach queues are managed automatically. Scheduled campaign follow-ups utilize Upstash QStash webhook processing to run correctly on serverless infrastructure.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}

function Trash2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}
