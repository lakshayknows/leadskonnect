import CardCarousel from "@/components/marketing/CardCarousel";
import BrandingApproach from "@/components/marketing/BrandingApproach";
import RedHero from "@/components/marketing/RedHero";
import Link from "next/link";

export default function Home() {
  return (
    <main className="bg-black">
      {/* 3D card carousel — full-viewport showpiece */}
      <section className="relative h-screen w-full">
        <CardCarousel />
        <Link
          href="/dashboard"
          className="absolute bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
        >
          Enter Overture
        </Link>
      </section>

      {/* Red manifesto hero */}
      <RedHero />

      {/* Branding approach editorial section */}
      <BrandingApproach />
    </main>
  );
}
