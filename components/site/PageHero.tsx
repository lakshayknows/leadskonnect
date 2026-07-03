export default function PageHero({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-canvas pt-36 pb-16 sm:pt-40">
      <div className="pointer-events-none absolute inset-0 grid-dots opacity-60" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 glow-brand" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        {kicker && <span className="eyebrow">{kicker}</span>}
        <h1 className="font-display mt-4 text-[clamp(2.4rem,5.5vw,4rem)] font-extrabold">{title}</h1>
        {subtitle && <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{subtitle}</p>}
      </div>
    </section>
  );
}
