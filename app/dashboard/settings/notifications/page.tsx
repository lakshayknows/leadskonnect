"use client";

import { useEffect, useState } from "react";
import { DashHeader, Panel, Banner } from "@/components/dashboard/ui";

type Prefs = Record<string, boolean>;

const OPTIONS: { key: string; title: string; desc: string }[] = [
  { key: "reply", title: "New reply", desc: "When a lead replies to one of your emails." },
  { key: "campaign_done", title: "Campaign finished", desc: "When every lead in a campaign has completed the sequence." },
  { key: "weekly_report", title: "Weekly summary", desc: "A Monday digest of sends, opens, and replies." },
  { key: "deliverability", title: "Deliverability alerts", desc: "When a mailbox's inbox placement drops." },
];

const DEFAULTS: Prefs = { reply: true, campaign_done: true, weekly_report: false, deliverability: true };
const STORAGE_KEY = "ft.notification.prefs";

export default function Page() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  function toggle(key: string) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
  }

  return (
    <>
      <DashHeader title="Notifications" subtitle="Choose what we email you about." />
      <div className="max-w-2xl space-y-4 p-8">
        {saved && <Banner kind="success">Preferences saved.</Banner>}
        <Panel className="divide-y divide-line !p-0">
          {OPTIONS.map((o) => (
            <div key={o.key} className="flex items-center justify-between gap-4 p-5">
              <div>
                <div className="text-sm font-semibold">{o.title}</div>
                <div className="text-xs text-ink-soft">{o.desc}</div>
              </div>
              <button
                role="switch"
                aria-checked={prefs[o.key]}
                aria-label={o.title}
                onClick={() => toggle(o.key)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${prefs[o.key] ? "bg-accent" : "bg-line"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${prefs[o.key] ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </Panel>
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-soft">Saved to this browser for now — server-side delivery is coming with billing.</p>
          <button onClick={save} className="btn btn-primary !py-2 !text-sm">Save preferences</button>
        </div>
      </div>
    </>
  );
}
