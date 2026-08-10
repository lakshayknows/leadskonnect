"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Check, ArrowRight, X } from "lucide-react";
import { api } from "@/lib/client";
import type { Activation } from "@/lib/queries";
import { Skeleton } from "@/components/ui";
import { tourTarget } from "@/components/dashboard/tour/target";

const STEPS: { key: keyof Activation; label: string; body: string; href: string; cta: string }[] = [
  {
    key: "sendingAccount",
    label: "Connect a mailbox",
    body: "Campaigns stay in draft until something can send them.",
    href: "/dashboard/accounts",
    cta: "Connect",
  },
  {
    key: "leads",
    label: "Add your contacts",
    body: "Import a CSV or add someone by hand.",
    href: "/dashboard/leads",
    cta: "Import",
  },
  {
    key: "template",
    label: "Write a template",
    body: "Reusable copy with the contact's details merged in.",
    href: "/dashboard/templates",
    cta: "Write one",
  },
  {
    key: "campaign",
    label: "Build a campaign",
    body: "Decide what goes out, and how long to wait between steps.",
    href: "/dashboard/campaigns",
    cta: "Build",
  },
  {
    key: "sent",
    label: "Send your first message",
    body: "Launch the campaign to a group and watch replies land in the inbox.",
    href: "/dashboard/campaigns",
    cta: "Launch",
  },
];

/**
 * Replaces the old static four-card grid, which rendered identically for a
 * brand-new workspace and a running one.
 *
 * Completion is derived server-side from real counts on every read — never
 * stored. A stored flag drifts the moment someone deletes the thing it was
 * counting, and then the checklist quietly lies. Only the *dismissal* persists.
 */
export function ActivationChecklist({ dismissed }: { dismissed: boolean }) {
  const { data, isLoading } = useSWR<Activation>("/api/activation");
  const [hidden, setHidden] = useState(dismissed);

  if (hidden) return null;

  if (isLoading || !data) {
    return (
      <section className="mt-10">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          {STEPS.map((s) => (
            <div key={s.key} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-[40%]" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const done = STEPS.filter((s) => data[s.key]).length;
  const complete = done === STEPS.length;
  const next = STEPS.find((s) => !data[s.key]);

  async function dismiss() {
    setHidden(true);
    await api("/api/onboarding", { method: "PATCH", body: { action: "dismiss-checklist" } }).catch(() => {});
  }

  return (
    <section className="mt-10" {...tourTarget("overview-checklist")}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-bold">
          {complete ? "You're set up" : "Finish setting up"}
        </h2>
        <span className="font-mono text-xs text-ink-soft">
          {done} of {STEPS.length}
        </span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-tint" aria-hidden>
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${(done / STEPS.length) * 100}%` }}
          />
        </div>
        <button
          onClick={dismiss}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-faint transition-colors hover:bg-tint hover:text-ink-soft"
        >
          <X className="h-3.5 w-3.5" /> Dismiss
        </button>
      </div>

      <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
        {STEPS.map((s) => {
          const isDone = data[s.key];
          const isNext = !isDone && s.key === next?.key;
          return (
            <li
              key={s.key}
              className={`flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-0 ${
                isNext ? "bg-accent-soft/40" : ""
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  isDone ? "border-success bg-success text-on-solid" : "border-line-strong text-ink-faint"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>

              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${isDone ? "text-ink-soft line-through" : ""}`}>{s.label}</div>
                {!isDone && <p className="mt-0.5 text-sm text-ink-soft">{s.body}</p>}
              </div>

              {!isDone && (
                <Link
                  href={s.href}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isNext
                      ? "bg-ink text-ink-invert hover:opacity-90"
                      : "text-ink-soft hover:bg-tint hover:text-ink"
                  }`}
                >
                  {s.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
