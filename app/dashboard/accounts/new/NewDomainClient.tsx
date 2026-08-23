"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Check,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  Mail,
  Search,
  Server,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/client";
import { Badge, Banner, Button, Input, Label, Panel, Select } from "@/components/ui";
import { DnsRecordTable, type DnsRecord } from "@/components/dashboard/DnsRecordTable";

type Suggestion = { domain: string; storeUrl: string };
type Suggestions = { seed: string | null; suggestions: Suggestion[] };

type DomainDetail = {
  id: string;
  name: string;
  status: string;
  dnsMode: "auto" | "manual";
  verifiedAt: string | null;
  failureReason: string | null;
  records: DnsRecord[];
  mailboxes: { id: string; email: string }[];
  /** Resolved server-side from the domain's real MX records. Null if unrecognised. */
  provider: {
    id: string;
    label: string;
    connectMethod: "oauth" | "password" | "manual";
    smtp: { host: string; port: number; secure: boolean } | null;
    imap: { host: string; port: number } | null;
  } | null;
};

const STEPS = [
  { key: "domain", label: "Domain", icon: Globe },
  { key: "dns", label: "DNS", icon: ShieldCheck },
  { key: "mailbox", label: "Mailbox", icon: AtSign },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const STATUS_LABEL: Record<string, string> = {
  dns_pending: "Waiting on DNS",
  active: "Ready to send",
  failed: "Needs attention",
  expired: "Expired",
};

// ---- step rail -------------------------------------------------------------

function StepRail({ current, reached }: { current: StepKey; reached: Set<StepKey> }) {
  const index = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Progress">
      <span className="sr-only" aria-live="polite">
        Step {index + 1} of {STEPS.length}: {STEPS[index]?.label}
      </span>
      <ol className="space-y-1">
        {STEPS.map((s, i) => {
          const done = reached.has(s.key) && i < index;
          const active = s.key === current;
          return (
            <li key={s.key}>
              <div
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  active ? "bg-accent-soft text-accent-strong" : "text-ink-soft"
                }`}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-success text-on-solid"
                      : active
                        ? "bg-accent text-on-solid"
                        : "border border-line"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                </span>
                <span className="text-sm font-semibold">{s.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---- wizard ----------------------------------------------------------------

export default function NewDomainClient({
  storeDomainsUrl,
  storeEmailUrl,
}: {
  storeDomainsUrl: string;
  storeEmailUrl: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const domainId = params.get("domain");
  const step = (params.get("step") ?? "domain") as StepKey;

  // The URL is the source of truth for position, so a refresh — or coming back
  // tomorrow while DNS was still propagating — lands on the same step.
  const goto = useCallback(
    (next: StepKey, extra?: Record<string, string>) => {
      const p = new URLSearchParams(params.toString());
      p.set("step", next);
      for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
      router.replace(`/dashboard/accounts/new?${p.toString()}`);
    },
    [params, router]
  );

  const { data: domain, mutate: refreshDomain } = useSWR<DomainDetail>(
    domainId ? `/api/domains/${domainId}` : null,
    { refreshInterval: (d) => (d && d.status === "dns_pending" ? 30_000 : 0) }
  );

  const reached = useMemo(() => {
    const s = new Set<StepKey>(["domain"]);
    if (domainId) {
      s.add("dns");
      s.add("mailbox");
    }
    return s;
  }, [domainId]);

  return (
    <div className="grid gap-8 p-8 lg:grid-cols-[200px_1fr]">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <StepRail current={step} reached={reached} />
        {domain && (
          <div className="mt-6 rounded-xl border border-line bg-surface p-4">
            <div className="break-all font-mono text-sm font-medium">{domain.name}</div>
            <div className="mt-1 text-xs text-ink-soft">{STATUS_LABEL[domain.status] ?? domain.status}</div>
          </div>
        )}
      </div>

      <div className="min-w-0 max-w-3xl">
        {step === "domain" && (
          <StepDomain
            storeDomainsUrl={storeDomainsUrl}
            onAdded={(id) => goto("dns", { domain: id })}
          />
        )}
        {step === "dns" && (
          <StepDns
            domain={domain}
            storeEmailUrl={storeEmailUrl}
            onRefresh={refreshDomain}
            onContinue={() => goto("mailbox")}
            onBack={() => goto("domain")}
          />
        )}
        {step === "mailbox" && (
          <StepMailbox domain={domain} onRefresh={refreshDomain} onBack={() => goto("dns")} />
        )}
      </div>
    </div>
  );
}

// ---- step 1: choose a name and buy it on the store -------------------------

function StepDomain({
  storeDomainsUrl,
  onAdded,
}: {
  storeDomainsUrl: string;
  onAdded: (domainId: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const [bought, setBought] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(raw.trim()), 300);
    return () => clearTimeout(t);
  }, [raw]);

  const { data, isLoading } = useSWR<Suggestions>(
    `/api/domains/suggest?q=${encodeURIComponent(query)}`
  );

  async function confirm() {
    const name = bought.trim().toLowerCase();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id: string }>("/api/domains", { body: { domain: name } });
      onAdded(res.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="eyebrow">Step one</span>
      <h1 className="font-display mt-2 text-3xl font-extrabold">Pick a domain to send from</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
        Send from a lookalike domain, not your main one. If a cold campaign ever trips a spam
        filter, the domain your invoices go out on keeps its reputation.
      </p>

      <div className="relative mt-7">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
          aria-hidden
        />
        <Input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Try your company name"
          className="!pl-10"
          aria-label="Suggest domains from a name"
          autoFocus
        />
      </div>

      <div className="mt-5 space-y-2">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[60px] animate-pulse rounded-xl border border-line bg-tint" />
          ))}

        {!isLoading &&
          data?.suggestions.map((s, i) => (
            <a
              key={s.domain}
              href={s.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setOpened(s.domain);
                // Pre-fill the confirmation field: by the time they come back
                // from the store, retyping the name they just bought is friction
                // for no reason.
                setBought(s.domain);
              }}
              className="flex w-full items-center gap-4 rounded-xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-ink"
            >
              <Globe className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium">
                {s.domain}
              </span>
              {i === 0 && <Badge tone="accent">Recommended</Badge>}
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-soft">
                Check price <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </span>
            </a>
          ))}

        {!isLoading && (data?.suggestions.length ?? 0) === 0 && (
          <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
            Type your company name to see some options.
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-ink-soft">
        Prices and availability are shown in{" "}
        <a
          href={storeDomainsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ink underline-offset-4 hover:underline"
        >
          our store
        </a>
        , which handles the purchase and the payment.
      </p>

      <Panel className="mt-8">
        <Label htmlFor="bought">Already registered it? Enter the domain</Label>
        <p className="mt-1 text-sm text-ink-soft">
          Paste the domain you bought and we&apos;ll take it from there — DNS check, then mailbox.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Input
            id="bought"
            value={bought}
            onChange={(e) => setBought(e.target.value)}
            placeholder="outreach-acme.com"
            className="min-w-0 flex-1 font-mono"
            onKeyDown={(e) => e.key === "Enter" && confirm()}
          />
          <Button onClick={confirm} loading={busy} disabled={!bought.trim()}>
            Continue
            {!busy && <ArrowRight className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
        {opened && !busy && (
          <p className="mt-3 text-xs text-ink-soft">
            Opened <span className="font-mono">{opened}</span> in the store — come back here once
            it&apos;s registered.
          </p>
        )}
        {error && (
          <div className="mt-3">
            <Banner kind="error">{error}</Banner>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---- step 2: DNS -----------------------------------------------------------

function StepDns({
  domain,
  storeEmailUrl,
  onRefresh,
  onContinue,
  onBack,
}: {
  domain: DomainDetail | undefined;
  storeEmailUrl: string;
  onRefresh: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [rechecking, setRechecking] = useState(false);

  if (!domain) {
    return <Loader2 className="h-5 w-5 animate-spin text-ink-soft" aria-label="Loading" />;
  }

  const verified = domain.records.filter((r) => r.status === "verified").length;
  const allGood = domain.records.length > 0 && verified === domain.records.length;

  async function recheck() {
    setRechecking(true);
    try {
      await api(`/api/domains/${domain!.id}/verify`, { method: "POST", body: {} });
      onRefresh();
    } finally {
      setRechecking(false);
    }
  }

  return (
    <div>
      <span className="eyebrow">Step two</span>
      <h1 className="font-display mt-2 text-3xl font-extrabold">
        {allGood ? "Your domain is ready" : "Point the mail records"}
      </h1>
      <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
        {allGood
          ? "Everything resolves. This domain can send."
          : "Buying Professional Email on the same domain sets most of these automatically. If you did that, they should turn green on their own within a few minutes."}
      </p>

      {!allGood && (
        <div className="mt-5">
          <Banner kind="info">
            Haven&apos;t bought email for this domain yet?{" "}
            <a
              href={storeEmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-4"
            >
              Add Professional Email in the store
            </a>{" "}
            — buying it on the same domain is what sets these records for you.
          </Banner>
        </div>
      )}

      {domain.failureReason && (
        <div className="mt-4">
          <Banner kind="error">{domain.failureReason}</Banner>
        </div>
      )}

      <Panel className="mt-6">
        <DnsRecordTable
          records={domain.records}
          mode="manual"
          onRecheck={recheck}
          rechecking={rechecking}
          lastCheckedAt={domain.records[0]?.lastCheckedAt ?? null}
        />
      </Panel>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button onClick={onContinue}>
          {allGood ? "Connect a mailbox" : "Continue in the background"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
        {!allGood && (
          <span className="text-sm text-ink-soft">
            We&apos;ll keep checking — you don&apos;t have to wait here.
          </span>
        )}
      </div>
    </div>
  );
}

// ---- step 3: connect the mailbox -------------------------------------------

/**
 * Three ways in, chosen by what the domain's MX records say its provider is:
 *
 *  - Google Workspace   one click, OAuth, no password anywhere.
 *  - A provider we know  address and password only; we already know the servers.
 *  - Anything else       the full server form, which is also always available
 *                        as an escape hatch from either of the above.
 *
 * Asking someone to look up an SMTP hostname for a mailbox they just bought from
 * us is work we can do for them, so it is never the default.
 */
function StepMailbox({
  domain,
  onRefresh,
  onBack,
}: {
  domain: DomainDetail | undefined;
  onRefresh: () => void;
  onBack: () => void;
}) {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [manual, setManual] = useState(false);
  const [server, setServer] = useState({ host: "", port: 587, secure: false });
  const [startWarmup, setStartWarmup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const provider = domain?.provider ?? null;
  const smtp = provider?.smtp ?? null;
  const method = manual ? "manual" : (provider?.connectMethod ?? "manual");

  // Seed the server fields from the detected provider, so switching to manual
  // starts from the right answer rather than an empty form.
  useEffect(() => {
    if (smtp) setServer({ host: smtp.host, port: smtp.port, secure: smtp.secure });
  }, [smtp]);

  // Coming back from the Google round trip.
  const connectedVia = params.get("connected");
  const oauthError = params.get("error");

  if (!domain) {
    return <Loader2 className="h-5 w-5 animate-spin text-ink-soft" aria-label="Loading" />;
  }

  function serverFields() {
    return manual
      ? server
      : { host: smtp?.host ?? server.host, port: smtp?.port ?? server.port, secure: smtp?.secure ?? server.secure };
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!domain) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/sending-accounts", {
        body: {
          ...serverFields(),
          name: email,
          email,
          user: email,
          pass,
          imapHost: provider?.imap?.host,
          imapPort: provider?.imap?.port,
          domainId: domain.id,
          startWarmup,
        },
      });
      setDone(true);
      onRefresh();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setTesting(true);
    setMsg(null);
    try {
      await api("/api/sending-accounts?test=true", {
        body: { ...serverFields(), name: email, email, user: email, pass },
      });
      setMsg({ kind: "success", text: "Connected — those details work." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  if (done || connectedVia) {
    const address = connectedVia || email;
    return (
      <div>
        <span className="eyebrow">All set</span>
        <h1 className="font-display mt-2 text-3xl font-extrabold">Mailbox connected</h1>
        <Panel className="mt-7">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
            <div>
              <p className="font-mono text-sm font-medium">{address}</p>
              <p className="mt-2 leading-relaxed text-ink-soft">
                Warm-up has started. It ramps over 21 days before any campaign uses this mailbox,
                so the first real send lands in an inbox rather than a spam folder.
              </p>
            </div>
          </div>
        </Panel>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard/accounts" className="btn btn-primary">
            Done <Check className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={`/dashboard/accounts/domains/${domain.id}`} className="btn btn-ghost">
            View domain
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span className="eyebrow">Step three</span>
      <h1 className="font-display mt-2 text-3xl font-extrabold">Connect your mailbox</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
        {method === "oauth"
          ? `This domain runs on ${provider?.label}. Connect it in one click — no password to copy.`
          : provider
            ? `This domain runs on ${provider.label}, so we already know the server settings. Just the address and password.`
            : `Create a mailbox on ${domain.name} in the store, then connect it here.`}
      </p>

      {oauthError && (
        <div className="mt-5">
          <Banner kind="error">Couldn&apos;t connect that account: {oauthError}</Banner>
        </div>
      )}

      {domain.mailboxes.length > 0 && (
        <div className="mt-5">
          <Banner kind="success">
            Already connected: {domain.mailboxes.map((m) => m.email).join(", ")}
          </Banner>
        </div>
      )}

      {method === "oauth" ? (
        <Panel className="mt-6">
          <a
            href={`/api/auth/google/start?domain=${domain.id}`}
            className="btn btn-primary w-full justify-center"
          >
            <Mail className="h-4 w-4" aria-hidden />
            Connect with Google
          </a>
          <p className="mt-3 text-sm text-ink-soft">
            Opens Google to authorise sending. Warm-up starts automatically once it is connected.
          </p>
        </Panel>
      ) : (
        <Panel className="mt-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Email address</Label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`priya@${domain.name}`}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                required
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="The mailbox password you set in the store"
              />
            </div>

            {/* Known servers are stated, not asked for. */}
            {!manual && smtp && (
              <p className="flex items-center gap-2 rounded-xl bg-tint px-3 py-2.5 font-mono text-xs text-ink-soft">
                <Server className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {smtp.host}:{smtp.port} · {smtp.secure ? "SSL/TLS" : "STARTTLS"}
              </p>
            )}

            {manual && (
              <div className="grid gap-4 sm:grid-cols-[1fr_110px_140px]">
                <div>
                  <Label>SMTP host</Label>
                  <Input
                    required
                    value={server.host}
                    onChange={(e) => setServer({ ...server, host: e.target.value })}
                    className="font-mono"
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input
                    required
                    type="number"
                    value={server.port}
                    onChange={(e) =>
                      setServer({
                        ...server,
                        port: Number.isNaN(+e.target.value) ? 587 : +e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Security</Label>
                  <Select
                    value={server.secure ? "ssl" : "tls"}
                    onChange={(e) => setServer({ ...server, secure: e.target.value === "ssl" })}
                  >
                    <option value="tls">STARTTLS</option>
                    <option value="ssl">SSL/TLS</option>
                  </Select>
                </div>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4">
              <input
                type="checkbox"
                checked={startWarmup}
                onChange={(e) => setStartWarmup(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span>
                <span className="flex items-center gap-2 font-semibold">
                  <Link2 className="h-4 w-4 text-accent" aria-hidden />
                  Start warm-up straight away
                </span>
                <span className="mt-1 block text-sm text-ink-soft">
                  Ramps sending over 21 days so a brand-new domain does not look like a spammer on
                  day one.
                </span>
              </span>
            </label>

            {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" loading={busy} disabled={testing || !email || !pass}>
                Connect mailbox
                {!busy && <ArrowRight className="h-4 w-4" aria-hidden />}
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={test}
                loading={testing}
                disabled={busy || !email || !pass}
              >
                {!testing && <ShieldCheck className="h-4 w-4 text-success" aria-hidden />}
                Test first
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {/* Alternatives, deliberately quiet — they are escape hatches, not choices
          the customer should have to weigh up before they can start. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        {method !== "oauth" && (
          <a
            href={`/api/auth/google/start?domain=${domain.id}`}
            className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Use a Google account instead
          </a>
        )}
        {!manual ? (
          <button
            type="button"
            onClick={() => setManual(true)}
            className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Enter server details manually
          </button>
        ) : (
          smtp && (
            <button
              type="button"
              onClick={() => setManual(false)}
              className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Use the detected settings
            </button>
          )
        )}
      </div>
    </div>
  );
}
