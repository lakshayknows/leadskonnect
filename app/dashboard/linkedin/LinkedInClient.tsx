"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Linkedin, Search, BookOpen, Send, Heart, Wrench,
  Eye, MousePointerClick, ShieldCheck, Lock, AlertTriangle, ArrowRight, type LucideIcon,
} from "lucide-react";
import { Badge, DashHeader, Panel, Skeleton } from "@/components/ui";
import { FindLeadsPanel } from "@/components/dashboard/FindLeadsPanel";
import { SourcingView } from "@/components/dashboard/SourcingView";
import {
  CATEGORIES, MECHANISM_LABEL, byCategory, liveCount,
  type CatalogueJob, type JobCategory, type Mechanism,
} from "@/lib/linkedin/catalogue";

type Usage = { cap: number; used: number; remaining: number; connected: boolean };

const CATEGORY_ICON: Record<JobCategory, LucideIcon> = {
  "Find people": Search,
  Research: BookOpen,
  "Reach out": Send,
  Engage: Heart,
  "Maintain your network": Wrench,
};

const MECHANISM_ICON: Record<Mechanism, LucideIcon> = {
  read: Eye,
  confirm: MousePointerClick,
  api: ShieldCheck,
  vendor: Lock,
};

/**
 * LinkedIn — everything Followthroo can do there, in one place.
 *
 * This screen has a sidebar row, which is an explicit exception to the rule in
 * CLAUDE.md about not growing the rail. The rule is about not giving every
 * feature equal billing; LinkedIn turned out to be a workspace of its own — 35
 * distinct jobs with their own inputs, limits and mechanisms. The previous
 * version hid the entrance in a dialog tab on Leads and failed the only test
 * that matters: the person who asked for it could not find it.
 *
 * The organising idea is the *mechanism*, not the feature list. What a person
 * needs to know before running anything is whether it only reads, whether it
 * will ask them to click send, or whether it goes through LinkedIn's own API —
 * because that is what decides the risk to their account.
 */
export default function LinkedInClient() {
  const { data } = useSWR<{ usage: Usage }>("/api/linkedin/scrape");
  const [tab, setTab] = useState<"start" | "activity" | "catalogue">("start");

  const usage = data?.usage;
  const live = liveCount();

  return (
    <>
      <DashHeader
        title="LinkedIn"
        subtitle={`${live} of 35 jobs live. Everything runs in your own browser — nothing of yours is stored on our servers.`}
        action={
          usage &&
          (usage.connected ? (
            <div className="text-right">
              <Badge tone="success">Extension connected</Badge>
              <p className="mt-1 font-mono text-[11px] text-ink-faint">
                {usage.remaining.toLocaleString()} / {usage.cap.toLocaleString()} rows left today
              </p>
            </div>
          ) : (
            <Link href="/dashboard/settings/linkedin" className="btn btn-primary !py-2 !text-sm">
              Connect the extension <ArrowRight className="h-4 w-4" />
            </Link>
          ))
        }
      />

      <div className="space-y-6 p-8">
        {usage && !usage.connected && (
          <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning-strong">
            <AlertTriangle className="h-4 w-4 shrink-0 translate-y-0.5" />
            <div>
              <p className="font-medium">Nothing here works until the extension is connected.</p>
              <p className="mt-1 text-xs">
                It runs inside your own logged-in LinkedIn tab. That is the whole design — we never
                hold your password or your session, so there is nothing of yours for us to lose.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-1 rounded-xl border border-line p-1">
          {([
            ["start", "Get people"],
            ["activity", "Activity"],
            ["catalogue", "Everything it can do"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === k ? "bg-ink text-ink-invert" : "text-ink-soft hover:bg-tint"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "start" && (
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            <Panel className="h-fit">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Linkedin className="h-4 w-4 text-accent" /> Get people from LinkedIn
              </h2>
              <p className="mt-1 text-xs text-ink-soft">
                Paste any LinkedIn page. We work out what it is — you do not pick a tool.
              </p>
              <FindLeadsPanel onQueued={() => setTab("activity")} />
            </Panel>

            <Panel className="h-fit">
              <h2 className="font-display text-base font-bold">How this stays safe</h2>
              <div className="mt-3 space-y-3 text-sm text-ink-soft">
                <p>
                  Every tool in the market for this asks you to hand over a LinkedIn session cookie,
                  which then lets their servers browse as you. We do not, because the extension{" "}
                  <em>is</em> your session — there is no credential to hand over, and none for us to
                  leak.
                </p>
                <p>
                  Reading is unlimited by us and capped by common sense. Sending is never automatic:
                  we fill the box and stop, and a real person clicks send. That distinction is what
                  keeps accounts alive.
                </p>
                <p className="text-xs text-ink-faint">
                  Daily ceilings follow the rates the market has settled on — 20 invites, 80
                  messages, 80 profile loads. They exist to protect your account, not to ration you.
                </p>
              </div>
            </Panel>
          </div>
        )}

        {tab === "activity" && <SourcingView />}

        {tab === "catalogue" && <Catalogue />}
      </div>
    </>
  );
}

/**
 * The full 35, grouped by what the person is trying to do rather than by the
 * tool's name — and honest about which are live, which are next, and which are
 * waiting on something outside our control.
 */
function Catalogue() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(MECHANISM_LABEL) as Mechanism[]).map((m) => {
          const Icon = MECHANISM_ICON[m];
          return (
            <div key={m} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-ink-soft" /> {MECHANISM_LABEL[m].label}
              </div>
              <p className="mt-1 text-xs text-ink-soft">{MECHANISM_LABEL[m].detail}</p>
            </div>
          );
        })}
      </div>

      {CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICON[category];
        const jobs = byCategory(category);
        return (
          <section key={category}>
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold">
              <Icon className="h-4 w-4 text-ink-soft" /> {category}
              <span className="font-sans text-xs font-normal text-ink-faint">
                {jobs.filter((j) => j.status === "live").length} of {jobs.length} live
              </span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (
                <JobCard key={job.key} job={job} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function JobCard({ job }: { job: CatalogueJob }) {
  const Icon = MECHANISM_ICON[job.mechanism];
  const dim = job.status !== "live";
  return (
    <div className={`rounded-xl border border-line p-3.5 ${dim ? "bg-tint/30" : "bg-surface"}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className={`text-sm font-semibold ${dim ? "text-ink-soft" : ""}`}>{job.name}</h3>
        {job.status === "live" ? (
          <Badge tone="success">Live</Badge>
        ) : job.status === "planned" ? (
          <Badge tone="neutral">Next</Badge>
        ) : (
          <Badge tone="warning">Blocked</Badge>
        )}
      </div>

      <p className="mt-1 text-xs text-ink-soft">{job.summary}</p>

      <div className="mt-2.5 space-y-1 border-t border-line pt-2.5 text-[11px] text-ink-faint">
        <p className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 shrink-0" /> {MECHANISM_LABEL[job.mechanism].label}
        </p>
        <p>Needs: {job.input}</p>
        {job.limit && <p>Limit: {job.limit}</p>}
        {job.requiresAdmin && <p>You must be an admin of that page.</p>}
      </div>

      {/* Say what it is waiting on. "Coming soon" with no reason is how a
          roadmap becomes noise. */}
      {(job.blockedReason || job.note) && (
        <p className="mt-2 rounded-lg bg-tint px-2.5 py-1.5 text-[11px] text-ink-soft">{job.blockedReason ?? job.note}</p>
      )}
    </div>
  );
}
