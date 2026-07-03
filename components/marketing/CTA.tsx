"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const FOOTER = {
  Product: ["Channels", "Sequences", "Templates", "AI Agent", "CRM"],
  Company: ["About", "Careers", "Blog", "Contact"],
  Resources: ["Docs", "API", "Rate limits", "Status"],
  Legal: ["Privacy", "Terms", "GDPR", "Security"],
};

export default function CTA() {
  return (
    <>
      {/* CTA band */}
      <section className="bg-canvas pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-[32px] bg-ink px-8 py-16 text-center text-white sm:px-14 sm:py-24">
            <div className="pointer-events-none absolute inset-0 opacity-[0.08] grid-dots" style={{ filter: "invert(1)" }} />
            <div className="relative">
              <h2 className="font-display mx-auto max-w-2xl text-[clamp(2rem,5vw,3.6rem)] font-extrabold">
                Start reaching leads <span className="gradient-text">where they reply</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-white/60">
                Import a list, write one message, let LeadsKonnect run the rest — safely.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/dashboard" className="btn btn-primary">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/dashboard" className="btn btn-ghost !border-white/25 !text-white hover:!border-white">
                  Book a demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-canvas py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 font-display text-lg font-bold">
                <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden>
                  <line x1="7" y1="13" x2="19" y2="13" stroke="var(--color-action)" strokeWidth="2.4" />
                  <circle cx="7" cy="13" r="5" fill="var(--color-brand)" />
                  <circle cx="19" cy="13" r="5" fill="#fff" stroke="var(--color-brand)" strokeWidth="2.4" />
                </svg>
                LeadsKonnect
              </div>
              <p className="mt-4 max-w-xs text-sm text-ink-soft">
                Personalized outreach across every channel — sequenced, throttled, and human.
              </p>
            </div>

            {Object.entries(FOOTER).map(([title, links]) => (
              <div key={title}>
                <div className="font-mono text-xs uppercase tracking-widest text-ink-soft">{title}</div>
                <ul className="mt-4 space-y-2.5">
                  {links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm text-ink-soft transition-colors hover:text-ink">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-xs text-ink-soft sm:flex-row">
            <span>© {new Date().getFullYear()} LeadsKonnect. All rights reserved.</span>
            <span className="font-mono">Made for teams who actually get replies.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
