import SiteShell from "@/components/site/SiteShell";
import PageHero from "@/components/site/PageHero";

export const metadata = { title: "Changelog — Followthroo" };

/**
 * Newest first. Add an entry in the same change that ships the work — a changelog
 * reconstructed later is a guess, not a record.
 */
const ENTRIES = [
  {
    version: "0.8.0",
    date: "Aug 2026",
    items: [
      "Every lead now has a Next Action — and the app works it out for you when you haven't set one",
      "New lead page: one timeline across email, WhatsApp, LinkedIn and stage changes, with notes and tasks beside it",
      "Tasks — Overdue, Today and Upcoming. A follow-up appears on its own when someone replies and nobody has answered",
      "Home became a work queue instead of a scoreboard: what needs you, who replied, what's overdue",
      "Sidebar cut from 18 items to 11 — Deliverability, Ageing, Escalations and Control tower moved under Reports",
      "Contacts are called Leads everywhere, in the menu and on the page",
      "Campaigns and the AI agent now ask which of your mailboxes to send from — outreach always goes out under your own domain, so replies come back to you and your sending reputation is yours alone",
    ],
  },
  {
    version: "0.7.0",
    date: "Aug 2026",
    items: [
      "AI agent runs on Claude and can move pipeline stages, qualify leads, and draft instead of send when unsure",
      "Channels declare what they can do — WhatsApp's 24-hour session window is now enforced, not assumed",
      "Quiet hours respect the contact's own local time, not the workspace's",
      "Tamper-evident compliance ledger: consent and suppression events are hash-chained and exportable",
      "Control tower — every open conversation across channels, attention-first",
      "Scheduled SLA sweep flags work that has gone quiet",
    ],
  },
  {
    version: "0.6.0",
    date: "Aug 2026",
    items: [
      "LinkedIn moved to a human-assisted model — we draft, you send from your own session",
      "One unified conversation per contact across email, LinkedIn and WhatsApp",
      "Department roles: admin → group leader → member, with data scoped to each",
      "Auto-assignment, capture notifications, and escalation up the hierarchy",
      "Lead scoring, source ROI, and a response-time leaderboard",
      "New lead sources: Google Ads, IndiaMART (incl. backfill), JustDial, Sulekha, TradeIndia",
      "Email-parsing fallback for aggregators with no webhook",
    ],
  },
  {
    version: "0.5.0",
    date: "Aug 2026",
    items: [
      "CRM core: identity graph resolves one person across email, phone and LinkedIn",
      "Generic pipeline engine — stages, SLAs, drag-and-drop, reason-on-backward-move",
      "Inbound adapters and a normalised lead-capture path",
      "First-run product tour and a rebuilt dashboard foundation",
      "Settings for lead sources, team hierarchy and pipelines",
      "Split the product app from the marketing site",
    ],
  },
  {
    version: "0.4.0",
    date: "Jul 2026",
    items: [
      "Multi-tenant workspaces with teams, roles and invitations",
      "Conditional campaigns — branch on replied / opened / clicked, stop on reply",
      "Unified inbox with reply capture across mailboxes",
      "Open and click tracking, reports, and a deliverability score per mailbox",
      "Mailbox warm-up that rescues its own mail from spam",
      "Gmail-OAuth accounts send through the Gmail API; scheduling moved to QStash",
      "LinkedIn companion Chrome extension with humanized pacing and daily caps",
    ],
  },
  { version: "0.3.0", date: "Jul 2026", items: ["Monochrome brand refresh", "New landing, dashboard, and 404", "Marketing pages for every section"] },
  { version: "0.2.0", date: "Jul 2026", items: ["Renamed to Followthroo", "AI agent on Claude"] },
  { version: "0.1.0", date: "Jul 2026", items: ["Email, WhatsApp, CRM foundations", "Rate limiting + sequences + templates"] },
];

export default function ChangelogPage() {
  return (
    <SiteShell>
      <PageHero kicker="Changelog" title="What's new" subtitle="Every release, newest first." />
      <section className="bg-canvas pb-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="space-y-10">
            {ENTRIES.map((e) => (
              <div key={e.version} className="flex gap-6">
                <div className="w-24 shrink-0">
                  <div className="font-display text-lg font-bold">{e.version}</div>
                  <div className="font-mono text-xs text-ink-soft">{e.date}</div>
                </div>
                <ul className="flex-1 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
                  {e.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
