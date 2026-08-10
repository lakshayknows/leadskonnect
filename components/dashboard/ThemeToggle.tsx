"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTheme, type ThemePref } from "./ThemeProvider";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Three-way theme control. A segmented group rather than a single toggle,
 * because "match my system" is a distinct choice from "always light" — a
 * two-state switch silently discards it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { pref, setPref } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-sunken p-0.5", className)}
    >
      {OPTIONS.map((o) => {
        const active = pref === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => setPref(o.value)}
            title={o.label}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors",
              active ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            <o.icon className="h-3.5 w-3.5" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
