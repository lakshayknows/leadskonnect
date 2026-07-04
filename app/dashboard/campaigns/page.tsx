"use client";

import { useEffect, useState } from "react";
import { Plus, X, Rocket } from "lucide-react";
import { api } from "@/lib/client";
import { DashHeader, Panel, Banner, Input, Select, Label } from "@/components/dashboard/ui";

type Template = { id: string; channel: string; name: string };
type Campaign = { id: string; name: string; status: string; sequence: Step[] };
type Step = { channel: string; templateId?: string; waitDays: number };

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ channel: "email", templateId: "", waitDays: 0 }]);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api<Campaign[]>("/api/campaigns").then(setCampaigns).catch(() => {});
    api<Template[]>("/api/templates").then(setTemplates).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  function setStep(i: number, patch: Partial<Step>) {
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const sequence = steps.map((s) => ({
        channel: s.channel,
        templateId: s.templateId || undefined,
        waitDays: Number(s.waitDays) || 0,
      }));
      await api("/api/campaigns", { body: { name, sequence } });
      setName("");
      setSteps([{ channel: "email", templateId: "", waitDays: 0 }]);
      setMsg({ kind: "success", text: "Campaign created." });
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
        text: `Queued ${res.enqueued} sends.${res.note ? " " + res.note : " Run `npm run worker` to process them."}`,
      });
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  return (
    <>
      <DashHeader title="Campaigns" subtitle="Sequence steps across channels, then launch to your leads." />
      <div className="grid gap-6 p-8 lg:grid-cols-[420px_1fr]">
        {/* Create */}
        <Panel className="h-fit">
          <h2 className="font-display text-lg font-bold">New campaign</h2>
          <form onSubmit={create} className="mt-4 space-y-4">
            <div>
              <Label>Name *</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 outbound" />
            </div>

            <div className="space-y-3">
              <Label>Sequence</Label>
              {steps.map((s, i) => (
                <div key={i} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs text-ink-soft">Step {i + 1}</span>
                    {steps.length > 1 && (
                      <button type="button" onClick={() => setSteps((st) => st.filter((_, idx) => idx !== i))} className="text-ink-soft hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={s.channel} onChange={(e) => setStep(i, { channel: e.target.value, templateId: "" })}>
                      <option value="email">Email</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="social">Social</option>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      value={s.waitDays}
                      onChange={(e) => setStep(i, { waitDays: Number(e.target.value) })}
                      placeholder="wait (days)"
                    />
                  </div>
                  <div className="mt-2">
                    <Select value={s.templateId} onChange={(e) => setStep(i, { templateId: e.target.value })}>
                      <option value="">No template (empty body)</option>
                      {templates.filter((t) => t.channel === s.channel).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSteps((s) => [...s, { channel: "email", templateId: "", waitDays: 2 }])}
                className="btn btn-ghost w-full justify-center !py-2 !text-sm"
              >
                <Plus className="h-4 w-4" /> Add step
              </button>
            </div>

            <button disabled={busy} className="btn btn-primary w-full justify-center disabled:opacity-50">Create campaign</button>
          </form>
        </Panel>

        {/* List */}
        <div className="space-y-4">
          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
          {campaigns.length === 0 ? (
            <Panel><p className="text-sm text-ink-soft">No campaigns yet.</p></Panel>
          ) : (
            campaigns.map((c) => (
              <Panel key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold">{c.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(c.sequence ?? []).map((s, i) => (
                        <span key={i} className="rounded-full bg-tint px-2.5 py-0.5 font-mono text-xs">
                          {s.channel}{s.waitDays ? ` +${s.waitDays}d` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs uppercase text-ink-soft">{c.status}</span>
                    <button onClick={() => launch(c.id)} className="btn btn-primary !py-2 !text-sm">
                      <Rocket className="h-4 w-4" /> Launch
                    </button>
                  </div>
                </div>
              </Panel>
            ))
          )}
          <p className="font-mono text-xs text-ink-soft">
            Launching queues jobs in Redis. Processing requires the worker: <code>npm run worker</code>.
          </p>
        </div>
      </div>
    </>
  );
}
