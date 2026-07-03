import SiteShell from "@/components/site/SiteShell";
import PageHero from "@/components/site/PageHero";

export const metadata = { title: "Changelog — LeadsKonnect" };

const ENTRIES = [
  { version: "0.3.0", date: "Jul 2026", items: ["Monochrome brand refresh", "New landing, dashboard, and 404", "Marketing pages for every section"] },
  { version: "0.2.0", date: "Jul 2026", items: ["Renamed to LeadsKonnect", "AI agent on claude-opus-4-8"] },
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
