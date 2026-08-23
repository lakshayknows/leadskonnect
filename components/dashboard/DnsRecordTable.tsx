"use client";

import { useState } from "react";
import { Check, Copy, Loader2, AlertTriangle, CircleDashed, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export type DnsRecord = {
  id: string;
  kind: string;
  type: string;
  host: string;
  expectedValue: string;
  observedValue: string | null;
  priority?: number | null;
  status: "pending" | "verified" | "mismatch" | "missing" | string;
  lastCheckedAt: string | null;
};

/**
 * Status is carried by an icon AND a word, never by colour alone — this table is
 * the one screen where a red/green distinction decides whether someone thinks
 * their domain works.
 */
const STATE = {
  verified: { icon: Check, label: "Verified", cls: "text-success" },
  mismatch: { icon: AlertTriangle, label: "Doesn't match", cls: "text-warning" },
  missing: { icon: CircleDashed, label: "Propagating", cls: "text-ink-soft" },
  pending: { icon: Loader2, label: "Checking", cls: "text-ink-soft animate-spin" },
} as const;

function stateFor(status: string) {
  return STATE[status as keyof typeof STATE] ?? STATE.pending;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      // 44px hit area via padding, even though the glyph is 14px.
      className="shrink-0 rounded-lg p-2.5 text-ink-soft transition-colors hover:bg-tint hover:text-ink"
      aria-label={copied ? "Copied" : `Copy ${value}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const OBSERVED_PREVIEW = 110;

function Observed({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = value.length > OBSERVED_PREVIEW;
  return (
    <div className="mt-1.5 font-mono text-xs text-warning-strong">
      <span className="break-all">
        Found instead: {expanded || !long ? value : `${value.slice(0, OBSERVED_PREVIEW)}…`}
      </span>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 underline underline-offset-2 hover:no-underline"
        >
          {expanded ? "show less" : "show all"}
        </button>
      )}
    </div>
  );
}

export function DnsRecordTable({
  records,
  mode,
  onRecheck,
  rechecking,
  lastCheckedAt,
}: {
  records: DnsRecord[];
  /** "auto" hides the copy affordances — nobody has to type these in. */
  mode: "auto" | "manual";
  onRecheck?: () => void;
  rechecking?: boolean;
  lastCheckedAt?: string | null;
}) {
  const verified = records.filter((r) => r.status === "verified").length;
  const total = records.length;
  const allGood = total > 0 && verified === total;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold">
            {allGood ? "All records verified" : `${verified} of ${total} records verified`}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            {allGood
              ? "This domain is ready to send from."
              : mode === "auto"
                ? "We've already pointed these for you. DNS usually settles in 5–15 minutes — you can leave this page."
                : "Add these at your DNS host. We'll keep checking until they show up."}
          </p>
        </div>
        {onRecheck && !allGood && (
          <Button variant="ghost" size="sm" onClick={onRecheck} loading={rechecking}>
            {!rechecking && <RefreshCw className="h-4 w-4" aria-hidden />}
            Check now
          </Button>
        )}
      </div>

      {/* Progress is a real meter, so assistive tech gets the same signal. */}
      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-tint"
        role="progressbar"
        aria-valuenow={verified}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="DNS records verified"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${allGood ? "bg-success" : "bg-accent"}`}
          style={{ width: total ? `${(verified / total) * 100}%` : "0%" }}
        />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="pb-2 pr-3 font-mono font-normal">Status</th>
              <th className="pb-2 pr-3 font-mono font-normal">Type</th>
              <th className="pb-2 pr-3 font-mono font-normal">Host</th>
              <th className="pb-2 font-mono font-normal">Value</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const s = stateFor(r.status);
              const Icon = s.icon;
              const showObserved = r.status === "mismatch" && r.observedValue;
              return (
                <tr key={r.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="py-3 pr-3">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Icon className={`h-4 w-4 shrink-0 ${s.cls}`} aria-hidden />
                      <span className="text-xs font-medium">{s.label}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">
                    {r.kind}
                    {r.kind !== r.type && <span className="text-ink-soft"> ({r.type})</span>}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">{r.host}</td>
                  <td className="py-3">
                    <div className="flex items-start gap-1">
                      <code className="min-w-0 flex-1 break-all font-mono text-xs">
                        {r.expectedValue}
                      </code>
                      {mode === "manual" && <CopyButton value={r.expectedValue} />}
                    </div>
                    {/* Showing what DNS actually returned is the difference between
                        "something is wrong" and "you typed one character wrong" —
                        but only the first line of it, because a real SPF record
                        can run to hundreds of characters and bury every other row. */}
                    {showObserved && <Observed value={r.observedValue!} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {lastCheckedAt && (
        <p className="mt-3 font-mono text-[11px] text-ink-soft">
          Last checked {new Date(lastCheckedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
