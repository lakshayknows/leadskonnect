"use client";

import { useState } from "react";
import useSWR from "swr";
import { Linkedin, Copy, Check, RefreshCw, Eye, EyeOff, Clock, Send, AlertTriangle, ListChecks } from "lucide-react";
import { api } from "@/lib/client";
import { Banner, DashHeader, Input, Label, Panel, useConfirm } from "@/components/ui";

type Connect = {
  extToken: string;
  status: string;
  liMemberName: string | null;
  lastSeenAt: string | null;
  dailyInviteCap: number;
  minDelaySec: number;
  maxDelaySec: number;
  queue: { pending: number; sentToday: number; failedToday: number };
};

const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://www.followthroo.com";

function recentlySeen(iso: string | null) {
  return !!iso && Date.now() - new Date(iso).getTime() < 15 * 60 * 1000;
}

export default function LinkedInClient() {
  const { data, mutate, isLoading } = useSWR<Connect>("/api/linkedin/connect");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [cap, setCap] = useState<number | "">("");
  const [minD, setMinD] = useState<number | "">("");
  const [maxD, setMaxD] = useState<number | "">("");

  const connected = data ? recentlySeen(data.lastSeenAt) : false;
  const confirm = useConfirm();

  async function rotate() {
    const ok = await confirm({
      title: "Rotate the extension token?",
      body: "The current token stops working immediately. You'll need to paste the new one into the Chrome extension before it can send again.",
      confirmLabel: "Rotate token",
      tone: "danger",
    });
    if (!ok) return;
    await api("/api/linkedin/connect", { body: { action: "rotate" } });
    setMsg({ kind: "success", text: "Token rotated. Paste the new one into the extension." });
    mutate();
  }
  async function saveSettings() {
    const body: Record<string, number> = {};
    if (cap !== "") body.dailyInviteCap = Number(cap);
    if (minD !== "") body.minDelaySec = Number(minD);
    if (maxD !== "") body.maxDelaySec = Number(maxD);
    if (Object.keys(body).length === 0) return;
    await api("/api/linkedin/connect", { body: { action: "update", ...body } });
    setMsg({ kind: "success", text: "LinkedIn settings saved." });
    setCap(""); setMinD(""); setMaxD("");
    mutate();
  }
  function copy() {
    if (!data) return;
    navigator.clipboard.writeText(data.extToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <DashHeader
        title="LinkedIn"
        subtitle="Source contacts and draft outreach from your own LinkedIn session, via the companion extension."
      />

      <div className="max-w-3xl space-y-6 p-8">
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

        <Banner kind="info">
          LinkedIn&apos;s API cannot read search results or send messages, so the extension works inside your own
          logged-in tab instead. It reads pages you ask for, and for invites and messages it fills the box and stops —
          you press send. That last part matters: automated sending is against LinkedIn&apos;s terms, and a real person
          clicking send is what keeps your account on the right side of it. Keep the caps conservative.
        </Banner>

        {/* Status + queue */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Panel className="!p-5 sm:col-span-1">
            <div className="flex items-center gap-2 text-ink-soft"><Linkedin className="h-4 w-4" /><span className="font-mono text-xs uppercase">Status</span></div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-success" : "bg-line-strong"}`} />
              <span className="font-display text-lg font-bold">{connected ? "Connected" : "Waiting"}</span>
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">{connected ? "extension is polling" : "start the extension"}</div>
          </Panel>
          <Panel className="!p-5"><div className="flex items-center gap-2 text-ink-soft"><ListChecks className="h-4 w-4" /><span className="font-mono text-xs uppercase">Queued</span></div><div className="mt-2 font-display text-3xl font-extrabold">{data?.queue.pending ?? 0}</div></Panel>
          <Panel className="!p-5"><div className="flex items-center gap-2 text-ink-soft"><Send className="h-4 w-4" /><span className="font-mono text-xs uppercase">Sent today</span></div><div className="mt-2 font-display text-3xl font-extrabold">{data?.queue.sentToday ?? 0}</div></Panel>
          <Panel className="!p-5"><div className="flex items-center gap-2 text-ink-soft"><AlertTriangle className="h-4 w-4" /><span className="font-mono text-xs uppercase">Failed today</span></div><div className="mt-2 font-display text-3xl font-extrabold">{data?.queue.failedToday ?? 0}</div></Panel>
        </div>

        {/* Token */}
        <Panel>
          <h2 className="font-display text-base font-bold">Connection token</h2>
          <p className="mt-1 text-sm text-ink-soft">Paste this into the extension. Treat it like a password.</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Input readOnly value={isLoading ? "…" : show ? data?.extToken ?? "" : "•".repeat(28)} className="!pr-10 font-mono" />
              <button onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink" aria-label="Toggle token visibility">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button onClick={copy} className="btn btn-ghost !py-2 !text-sm">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button>
            <button onClick={rotate} className="btn btn-ghost !py-2 !text-sm"><RefreshCw className="h-4 w-4" /> Rotate</button>
          </div>
        </Panel>

        {/* Caps + pacing */}
        <Panel>
          <h2 className="font-display text-base font-bold">Safety limits</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Daily invite cap</Label>
              <Input type="number" min={1} max={50} placeholder={String(data?.dailyInviteCap ?? 20)} value={cap} onChange={(e) => setCap(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <Label>Min delay (sec)</Label>
              <Input type="number" min={10} placeholder={String(data?.minDelaySec ?? 45)} value={minD} onChange={(e) => setMinD(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <Label>Max delay (sec)</Label>
              <Input type="number" min={15} placeholder={String(data?.maxDelaySec ?? 120)} value={maxD} onChange={(e) => setMaxD(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-ink-soft"><Clock className="h-3.5 w-3.5" /> The extension waits a random delay in this range between actions.</div>
          <button onClick={saveSettings} className="btn btn-primary mt-4 !py-2 !text-sm">Save limits</button>
        </Panel>

        {/* Install */}
        <Panel>
          <h2 className="font-display text-base font-bold">Install the extension</h2>
          <ol className="mt-3 space-y-2 text-sm text-ink-soft">
            <li><b className="text-ink">1.</b> Install <b>Followthroo for LinkedIn</b> from the Chrome Web Store. (Before it is published: get the <code>extension/</code> folder, open <code>chrome://extensions</code>, enable <b>Developer mode</b> and <b>Load unpacked</b>.)</li>
            <li><b className="text-ink">2.</b> Click the extension icon → <b>Settings</b> → set App URL to <code>{appOrigin}</code>, paste the token above → <b>Connect</b>.</li>
            <li><b className="text-ink">3.</b> Click <b>Start</b>, and stay logged into LinkedIn in the same browser.</li>
            <li><b className="text-ink">4.</b> Source contacts from <b>LinkedIn</b> in the sidebar — paste any search, profile, company, post, group or event.</li>
            <li><b className="text-ink">5.</b> Queued invites and messages open in a tab with the text filled in. Read it, then send it yourself.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-soft">
            Campaign selection, per-campaign caps and pacing live on the extension&apos;s Settings page. Nothing about
            your LinkedIn login is ever sent to us — see our{" "}
            <a href="/extension-privacy" className="underline">extension privacy notice</a>.
          </p>
        </Panel>
      </div>
    </>
  );
}
