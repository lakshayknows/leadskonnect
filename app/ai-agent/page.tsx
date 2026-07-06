import SiteShell from "@/components/site/SiteShell";
import PageHero from "@/components/site/PageHero";
import { FeatureGrid, CTABand } from "@/components/site/blocks";
import { Bot, Lock, Gauge } from "lucide-react";

export const metadata = { title: "AI Agent — Followthroo" };

export default function AiAgentPage() {
  return (
    <SiteShell>
      <PageHero
        kicker="AI Agent"
        title="An agent that runs the whole campaign"
        subtitle="Powered by Claude (claude-opus-4-8). Give it a brief and a lead list; it personalizes and sends across channels — and can never outrun a rate limit."
      />
      <FeatureGrid
        items={[
          { icon: Bot, title: "Brief in, sends out", body: "Describe the goal and tone. The agent drafts and sends the right message on the right channel per lead." },
          { icon: Lock, title: "Guardrailed tools", body: "Every action goes through the same safe path — suppression and rate limits are enforced, not optional." },
          { icon: Gauge, title: "Knows the limits", body: "40 emails/hour, ~20 LinkedIn invites/day, 250 WhatsApp/day — the agent stops before it trips a cap." },
        ]}
      />
      <CTABand cta="Try the agent" />
    </SiteShell>
  );
}
