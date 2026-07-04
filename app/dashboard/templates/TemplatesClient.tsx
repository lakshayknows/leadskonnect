"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/client";
import { DashHeader, Panel, Banner, Input, Textarea, Select, Label } from "@/components/dashboard/ui";

type Template = { id: string; channel: string; name: string; subject: string | null; body: string };

export default function TemplatesPage() {
  const { data: templates = [], mutate } = useSWR<Template[]>("/api/templates");
  const [form, setForm] = useState({ channel: "email", name: "", subject: "", body: "" });
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/templates", { body: { ...form, subject: form.subject || undefined } });
      setForm({ channel: "email", name: "", subject: "", body: "" });
      setMsg({ kind: "success", text: "Template saved." });
      mutate();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DashHeader title="Templates" subtitle="Write once, personalize for everyone with {{variables}}." />
      <div className="grid gap-6 p-8 lg:grid-cols-[380px_1fr]">
        <Panel className="h-fit">
          <h2 className="font-display text-lg font-bold">New template</h2>
          <form onSubmit={create} className="mt-4 space-y-3">
            <div>
              <Label>Channel</Label>
              <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="social">Social</option>
              </Select>
            </div>
            <div>
              <Label>Name *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Intro email" />
            </div>
            {form.channel === "email" && (
              <div>
                <Label>Subject</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Quick idea for {{company}}" />
              </div>
            )}
            <div>
              <Label>Body *</Label>
              <Textarea
                required
                rows={6}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder={"Hi {{firstName|there}}, I noticed {{company}} is scaling — thought this might help."}
              />
            </div>
            <button disabled={busy} className="btn btn-primary w-full justify-center disabled:opacity-50">Save template</button>
          </form>
          <p className="mt-4 font-mono text-xs text-ink-soft">Use {"{{firstName|there}}"} for a safe fallback.</p>
        </Panel>

        <div className="space-y-4">
          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
          {templates.length === 0 ? (
            <Panel><p className="text-sm text-ink-soft">No templates yet.</p></Panel>
          ) : (
            templates.map((t) => (
              <Panel key={t.id}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">{t.name}</h3>
                  <span className="rounded-full bg-tint px-2.5 py-0.5 font-mono text-xs">{t.channel}</span>
                </div>
                {t.subject && <div className="mt-2 text-sm font-medium">Subject: {t.subject}</div>}
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-soft">{t.body}</pre>
              </Panel>
            ))
          )}
        </div>
      </div>
    </>
  );
}
