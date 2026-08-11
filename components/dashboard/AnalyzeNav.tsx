"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ShieldCheck, AlertTriangle, Bell, Radio } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Sub-navigation for the analysis screens.
 *
 * These used to be five separate rows in the sidebar, which is how a rail grows
 * to eighteen items and stops being navigable. They're one level in now — but
 * they're siblings in the route tree, not children of /dashboard/reports, so a
 * shared layout can't cover them. Each page renders this instead, which keeps
 * the trail visible without inventing a route hierarchy that doesn't exist.
 */
const LINKS = [
  { href: "/dashboard/reports", icon: BarChart3, label: "Reports" },
  { href: "/dashboard/deliverability", icon: ShieldCheck, label: "Deliverability" },
  { href: "/dashboard/ageing", icon: AlertTriangle, label: "Ageing" },
  { href: "/dashboard/escalations", icon: Bell, label: "Escalations" },
  { href: "/dashboard/control-tower", icon: Radio, label: "Control tower" },
];

export function AnalyzeNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Analysis" className="flex gap-1 overflow-x-auto border-b border-line px-8 py-2">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
              active ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink-soft hover:bg-tint hover:text-ink",
            )}
          >
            <l.icon className={cn("h-3.5 w-3.5", active && "text-accent")} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
