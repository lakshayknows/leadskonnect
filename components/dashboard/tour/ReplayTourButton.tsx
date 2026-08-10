"use client";

import { Compass, ArrowRight } from "lucide-react";
import { useTour } from "./TourProvider";
import { useToast } from "@/components/ui";

/**
 * Settings entry point for replaying the tour. A client island so
 * `app/dashboard/settings/page.tsx` can stay a server component.
 */
export function ReplayTourCard() {
  const { start } = useTour();
  const toast = useToast();

  return (
    <button
      onClick={() => {
        if (window.innerWidth < 1024) {
          toast("The tour needs a wider screen — open Followthroo on a desktop to replay it.", "info");
          return;
        }
        start(0);
      }}
      className="group flex items-start gap-4 rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition hover:border-accent hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
        <Compass className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 font-display text-base font-bold">
          Product tour
          <ArrowRight className="h-4 w-4 text-ink-soft/0 transition group-hover:text-accent" />
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">Replay the walkthrough of contacts, campaigns and the inbox.</p>
      </div>
    </button>
  );
}

/** Compact variant for the sidebar account menu. */
export function ReplayTourMenuItem({ onNavigate }: { onNavigate?: () => void }) {
  const { start } = useTour();

  return (
    <button
      onClick={() => {
        onNavigate?.();
        start(0);
      }}
      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-tint hover:text-ink"
    >
      <Compass className="h-4 w-4" /> Replay product tour
    </button>
  );
}
