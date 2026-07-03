import SiteShell from "@/components/site/SiteShell";
import PageHero from "@/components/site/PageHero";
import { Prose, CTABand } from "@/components/site/blocks";

export const metadata = { title: "About — LeadsKonnect" };

export default function AboutPage() {
  return (
    <SiteShell>
      <PageHero
        kicker="About"
        title="We build outreach that stays human"
        subtitle="LeadsKonnect exists to align messy, scattered outreach into one clear, consistent story — across every channel."
      />
      <Prose>
        <p>
          We kept seeing the same pattern: teams with real value to offer, lost between spreadsheets,
          disconnected tools, and outreach that either felt robotic or got their accounts flagged.
        </p>
        <h2>Our belief</h2>
        <p>
          Personalized outreach gets replies; generic blasts get ignored. But personalization at scale is
          hard, and every platform has hard limits. LeadsKonnect handles both — so you can reach more
          people, more genuinely, without waking the spam kraken.
        </p>
        <h2>How we work</h2>
        <p>
          Safety is the default, not a setting. Every send passes a rate-limit and consent check first.
          When patterns stay predictable, trust builds — for your prospects and your sending accounts alike.
        </p>
      </Prose>
      <CTABand />
    </SiteShell>
  );
}
