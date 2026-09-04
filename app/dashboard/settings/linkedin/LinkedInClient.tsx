"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Linkedin, Copy, Check, RefreshCw, Eye, EyeOff, Clock, Send, AlertTriangle,
  ListChecks, Puzzle, ShieldCheck, ExternalLink,
} from "lucide-react";
import { api } from "@/lib/client";
import { Banner, DashHeader, Input, Label, Panel, useConfirm } from "@/components/ui";

type AccountState = "disconnected" | "expiring" | "expired" | "connected";

type Connect = {
  extToken: string;
  status: string;
  liMemberName: string | null;
  lastSeenAt: string | null;
  dailyInviteCap: number;
  minDelaySec: number;
  maxDelaySec: number;
  account: {
    state: AccountState;
    configured: boolean;
    memberName: string | null;
    pictureUrl: string | null;
    email: string | null;
    expiresAt: string | null;
    connectedAt: string | null;
    scopes: string[];
    canPost: boolean;
    requestedScopes: string[];
  };
  queue: { pending: number; sentToday: number; failedToday: number };
};

const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://www.followthroo.com";

function recentlySeen(iso: string | null) {
  return !!iso && Date.now() - new Date(iso).getTime() < 15 * 60 * 1000;
}

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/** LinkedIn's own cancellation codes are member choices, not faults. */
const OAUTH_ERRORS: Record<string, string> = {
  user_cancelled_login: "You closed LinkedIn's sign-in before finishing. Nothing was connected.",
  user_cancelled_authorize: "You declined the permissions, so nothing was connected.",
  linkedin_not_configured: "LinkedIn isn't configured on this deployment yet.",
  state_mismatch: "That connection link expired. Please try again.",
  could_not_read_profile: "LinkedIn accepted the login but wouldn't return your profile. Try again.",
};

export default function LinkedInClient() {
  const { data, mutate, isLoading } = useSWR<Connect>("/api/linkedin/connect");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [cap, setCap] = useState<number | "">("");
  const [minD, setMinD] = useState<number | "">("");
  const [maxD, setMaxD] = useState<number | "">("");

  const extensionRunning = data ? recentlySeen(data.lastSeenAt) : false;
  const acct = data?.account;
  const confirm = useConfirm();

  // Read the OAuth round-trip result, then strip it from the URL so a refresh
  // doesn't replay a stale "connected" banner.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (!connected && !error) return;
    if (connected) {
      setMsg({
        kind: "success",
        text: connected === "1" ? "LinkedIn account connected." : `Connected as ${connected}.`,
      });
    } else if (error) {
      const known = OAUTH_ERRORS[error];
      setMsg({ kind: known ? "info" : "error", text: known ?? `Could not connect LinkedIn (${error}).` });
    }
    window.history.replaceState({}, "", window.location.pathname);
    mutate();
  }, [mutate]);

  async function disconnect() {
    const ok = await confirm({
      title: "Disconnect your LinkedIn account?",
      body: "We'll delete the stored LinkedIn tokens. Scheduled posts will stop until you reconnect. Your contacts and campaigns are unaffected.",
      confirmLabel: "Disconnect",
      tone: "danger",
    });
    if (!ok) return;
    await api("/api/linkedin/connect", { body: { action: "disconnect" } });
    setMsg({ kind: "info", text: "LinkedIn account disconnected." });
    mutate();
  }

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

  const expiry = daysLeft(acct?.expiresAt ?? null);

  return (
    <>
      <DashHeader
        title="LinkedIn"
        subtitle="Connect your LinkedIn account, then activate it in the browser you prospect from."
      />

      <div className="max-w-3xl space-y-6 p-8">
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

        {/* ---- Step 1: the account connection ---- */}
        <Panel>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                <h2 className="font-display text-base font-bold">Your LinkedIn account</h2>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                Sign in with LinkedIn so we know who you are and can post to your feed on your behalf.
              </p>
            </div>
            {acct?.state && acct.state !== "disconnected" && (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  acct.state === "connected"
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
                }`}
              >
                {acct.state === "connected" ? "Connected" : acct.state === "expiring" ? "Expiring soon" : "Expired"}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="mt-5 h-12 animate-pulse rounded-xl bg-tint" />
          ) : !acct?.configured ? (
            <Banner kind="error" className="mt-4">
              LinkedIn sign-in isn&apos;t configured on this deployment. Set <code>LINKEDIN_CLIENT_ID</code> and{" "}
              <code>LINKEDIN_CLIENT_SECRET</code>, and register{" "}
              <code>{appOrigin}/api/linkedin/oauth/callback</code> as an authorised redirect URL in the LinkedIn
              Developer Portal.
            </Banner>
          ) : acct.state === "disconnected" ? (
            <div className="mt-5">
              <a href="/api/linkedin/oauth/start" className="btn btn-primary !py-2.5 !text-sm">
                <Linkedin className="h-4 w-4" /> Connect LinkedIn account
              </a>
              <p className="mt-3 text-xs text-ink-soft">
                Opens LinkedIn&apos;s own consent screen. You sign in on linkedin.com — we never see your password.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-tint/40 p-4">
                {acct.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={acct.pictureUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0A66C2] font-display text-base font-bold text-white">
                    {(acct.memberName ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-sm font-bold">{acct.memberName ?? "LinkedIn member"}</div>
                  {acct.email && <div className="truncate text-xs text-ink-soft">{acct.email}</div>}
                </div>
                <button onClick={disconnect} className="btn btn-ghost !py-1.5 !text-xs">Disconnect</button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {acct.canPost ? "Can post to your feed" : "Identity only — posting not granted"}
                </span>
                {expiry !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {expiry < 0 ? "Expired — reconnect to resume" : `Renews in ${expiry} day${expiry === 1 ? "" : "s"}`}
                  </span>
                )}
              </div>

              {(acct.state === "expiring" || acct.state === "expired") && (
                <a href="/api/linkedin/oauth/start" className="btn btn-primary mt-4 !py-2 !text-sm">
                  <RefreshCw className="h-4 w-4" /> Reconnect
                </a>
              )}
            </>
          )}

          {/* The question this page has to answer, because everyone asks it. */}
          <details className="mt-5 rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Why do I also need the extension?
            </summary>
            <div className="mt-3 space-y-3 text-sm text-ink-soft">
              <p>
                LinkedIn&apos;s API lets an app confirm who you are and publish to your feed. It does not sell access to
                search results, a company&apos;s employees, post likers, connection invitations or messages — not on any
                paid tier. So a connected account alone cannot prospect.
              </p>
              <p>
                Tools that appear to do it anyway ask for your LinkedIn session cookie and then browse as you from their
                own servers. That works until it doesn&apos;t: a session used from a data centre you have never signed in
                from is the clearest signal LinkedIn&apos;s enforcement has, and it is why restrictions in that category
                are common.
              </p>
              <p>
                We split it instead. Your account connection is real and official. The reading and drafting happens in
                your own browser, in your own session, where it looks like exactly what it is — you, using LinkedIn.
              </p>
            </div>
          </details>
        </Panel>

        {/* ---- Step 2: the browser ---- */}
        <Panel>
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <Puzzle className="h-4 w-4" />
                <h2 className="font-display text-base font-bold">Activate in your browser</h2>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                Sourcing and drafting run in your own logged-in tab, via the companion extension.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                extensionRunning ? "bg-success/10 text-success" : "bg-tint text-ink-soft"
              }`}
            >
              {extensionRunning ? "Running" : "Not running"}
            </span>
          </div>

          <div className="mt-4">
            <Label>Pairing token</Label>
            <p className="mb-2 text-xs text-ink-soft">Paste this into the extension once. Treat it like a password.</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input readOnly value={isLoading ? "…" : show ? data?.extToken ?? "" : "•".repeat(28)} className="!pr-10 font-mono" />
                <button onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink" aria-label="Toggle token visibility">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button onClick={copy} className="btn btn-ghost !py-2 !text-sm">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button>
              <button onClick={rotate} className="btn btn-ghost !py-2 !text-sm"><RefreshCw className="h-4 w-4" /> Rotate</button>
            </div>
          </div>

          <ol className="mt-5 space-y-2 text-sm text-ink-soft">
            <li><b className="text-ink">1.</b> Install <b>Followthroo for LinkedIn</b> from the Chrome Web Store. (Before it is published: get the <code>extension/</code> folder, open <code>chrome://extensions</code>, enable <b>Developer mode</b> and <b>Load unpacked</b>.)</li>
            <li><b className="text-ink">2.</b> Click the extension icon → <b>Settings</b> → set App URL to <code>{appOrigin}</code>, paste the token above → <b>Connect</b>.</li>
            <li><b className="text-ink">3.</b> Click <b>Start</b>, and stay logged into LinkedIn in the same browser.</li>
            <li><b className="text-ink">4.</b> Source contacts from <b>LinkedIn</b> in the sidebar — paste any search, profile, company, post, group or event.</li>
            <li><b className="text-ink">5.</b> Queued invites and messages open in a tab with the text filled in. Read it, then send it yourself.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-soft">
            Nothing about your LinkedIn login is ever sent to us — see our{" "}
            <a href="/extension-privacy" className="inline-flex items-center gap-1 underline">
              extension privacy notice <ExternalLink className="h-3 w-3" />
            </a>.
          </p>
        </Panel>

        {/* ---- Queue ---- */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel className="!p-5"><div className="flex items-center gap-2 text-ink-soft"><ListChecks className="h-4 w-4" /><span className="font-mono text-xs uppercase">Queued</span></div><div className="mt-2 font-display text-3xl font-extrabold">{data?.queue.pending ?? 0}</div></Panel>
          <Panel className="!p-5"><div className="flex items-center gap-2 text-ink-soft"><Send className="h-4 w-4" /><span className="font-mono text-xs uppercase">Sent today</span></div><div className="mt-2 font-display text-3xl font-extrabold">{data?.queue.sentToday ?? 0}</div></Panel>
          <Panel className="!p-5"><div className="flex items-center gap-2 text-ink-soft"><AlertTriangle className="h-4 w-4" /><span className="font-mono text-xs uppercase">Failed today</span></div><div className="mt-2 font-display text-3xl font-extrabold">{data?.queue.failedToday ?? 0}</div></Panel>
        </div>

        {/* ---- Safety limits ---- */}
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
      </div>
    </>
  );
}
