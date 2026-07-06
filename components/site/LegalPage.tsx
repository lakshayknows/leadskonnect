import SiteShell from "@/components/site/SiteShell";
import PageHero from "@/components/site/PageHero";
import { Prose } from "@/components/site/blocks";

export default function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}) {
  return (
    <SiteShell>
      <PageHero kicker="Legal" title={title} subtitle={`Last updated ${updated}`} />
      <Prose>
        {sections.map((s) => (
          <div key={s.heading}>
            <h2>{s.heading}</h2>
            <p>{s.body}</p>
          </div>
        ))}
        <p className="pt-6 text-xs">
          This is a template document for Followthroo and not legal advice. Replace with counsel-reviewed
          text before launch.
        </p>
      </Prose>
    </SiteShell>
  );
}
