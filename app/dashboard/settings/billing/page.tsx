import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { DashHeader, Panel } from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    tagline: "Get outreach running.",
    current: true,
    features: ["1 sending mailbox", "Up to 500 contacts", "Email campaigns", "Shared inbox", "Basic reports"],
  },
  {
    name: "Pro",
    price: "$49",
    tagline: "Scale sending, safely.",
    features: ["Unlimited mailboxes", "Unlimited contacts", "Conditional sequences", "Mailbox warm-up", "Open & click tracking"],
    highlight: true,
  },
  {
    name: "Team",
    price: "Let's talk",
    tagline: "For whole revenue teams.",
    features: ["Everything in Pro", "Roles & permissions", "Shared templates & groups", "Priority support", "Onboarding"],
  },
];

export default function Page() {
  return (
    <>
      <DashHeader title="Plans & billing" subtitle="You're on the Free plan." />
      <div className="p-8">
        <div className="grid max-w-5xl gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <Panel key={p.name} className={`relative flex flex-col ${p.highlight ? "!border-accent ring-1 ring-accent" : ""}`}>
              {p.highlight && (
                <span className="absolute -top-3 left-5 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  <Sparkles className="h-3 w-3" /> Popular
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-extrabold">{p.name}</h2>
                {p.current && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-strong">Current</span>}
              </div>
              <p className="mt-1 text-sm text-ink-soft">{p.tagline}</p>
              <div className="mt-4 font-display text-3xl font-extrabold">
                {p.price}
                {p.price.startsWith("$") && <span className="text-base font-medium text-ink-soft">/mo</span>}
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {f}
                  </li>
                ))}
              </ul>
              {p.current ? (
                <button disabled className="btn btn-ghost mt-6 w-full cursor-default justify-center opacity-60">Current plan</button>
              ) : (
                <Link href="/contact" className={`mt-6 w-full justify-center ${p.highlight ? "btn btn-primary" : "btn btn-ghost"}`}>
                  {p.name === "Team" ? "Contact sales" : "Upgrade"}
                </Link>
              )}
            </Panel>
          ))}
        </div>
        <p className="mt-6 max-w-5xl text-xs text-ink-soft">
          Self-serve checkout isn't wired up yet — reach out and we'll switch your plan manually.
        </p>
      </div>
    </>
  );
}
