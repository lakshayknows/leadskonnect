import SiteShell from "@/components/site/SiteShell";
import PageHero from "@/components/site/PageHero";
import { FeatureGrid, CTABand } from "@/components/site/blocks";
import { Users, History, FileDown } from "lucide-react";

export const metadata = { title: "CRM — LeadsKonnect" };

export default function CrmPage() {
  return (
    <SiteShell>
      <PageHero
        kicker="CRM"
        title="Every lead and every touch, in one place"
        subtitle="Stages, tags, and a full activity timeline across all channels — no context lost between the inbox and the outreach."
      />
      <FeatureGrid
        items={[
          { icon: Users, title: "Lead records", body: "Name, email, phone, LinkedIn, stage, tags, plus any custom fields from your imports." },
          { icon: History, title: "Activity log", body: "Sent, delivered, opened, clicked, replied — every event on a single timeline per lead." },
          { icon: FileDown, title: "Import & export", body: "CSV in with automatic dedupe by email; export lists and results whenever you need them." },
        ]}
      />
      <CTABand cta="Open dashboard" />
    </SiteShell>
  );
}
