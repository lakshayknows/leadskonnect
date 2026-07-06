import SiteShell from "@/components/site/SiteShell";
import PageHero from "@/components/site/PageHero";
import { FeatureGrid, CTABand } from "@/components/site/blocks";
import { Waypoints, Clock, GitBranch } from "lucide-react";

export const metadata = { title: "Sequences — Followthroo" };

export default function SequencesPage() {
  return (
    <SiteShell>
      <PageHero
        kicker="Sequences"
        title="Multi-step outreach that reacts to replies"
        subtitle="Chain email → LinkedIn → WhatsApp with waits between steps. A reply anywhere pauses the rest for that lead automatically."
      />
      <FeatureGrid
        items={[
          { icon: Waypoints, title: "Cross-channel steps", body: "Mix channels in one flow. Each step goes through the same rate-limit and suppression checks." },
          { icon: Clock, title: "Waits & jitter", body: "Set waits in days; we add human-like jitter of 30–90s so patterns never look automated." },
          { icon: GitBranch, title: "Reply branching", body: "Opens, clicks, and replies advance or stop a lead. Unsubscribes drop them from every future step." },
        ]}
      />
      <CTABand />
    </SiteShell>
  );
}
