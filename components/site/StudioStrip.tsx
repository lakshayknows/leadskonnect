import { ArrowUpRight } from "lucide-react";

/**
 * Who builds this. Sits between the last product section and the CTA, and is
 * deliberately the quietest block on the page — no scroll animation, no display
 * headline. The page decelerates here before the CTA asks for something.
 */

const DISCIPLINES = [
  "Custom software",
  "AI solutions",
  "Performance marketing",
  "AI ad creative",
  "Social media",
  "Ecommerce & CMS",
];

export default function StudioStrip() {
  return (
    <section className="bg-canvas pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-[32px] bg-tint px-8 py-10 sm:px-12 sm:py-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            <div className="max-w-xl">
              <span className="eyebrow">The studio</span>
              <p className="font-display mt-3 text-2xl font-bold sm:text-[1.75rem]">
                Followthroo is built by brandstac
              </p>
              <p className="mt-3 leading-relaxed text-ink-soft">
                A creative technology studio in New Delhi that designs, engineers and markets
                products end to end — six disciplines, one standard. Followthroo is its in-house
                product.
              </p>
            </div>

            <div className="shrink-0 lg:max-w-xs">
              <ul className="flex flex-wrap gap-2">
                {DISCIPLINES.map((d) => (
                  <li
                    key={d}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] text-ink-soft"
                  >
                    {d}
                  </li>
                ))}
              </ul>
              <a
                href="https://brandstac.com/services"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline-offset-4 hover:underline"
              >
                See what brandstac does
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
