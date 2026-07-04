"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileText, Rocket, Bot, ArrowUpRight } from "lucide-react";

const NAV = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/dashboard/leads", icon: Users },
  { label: "Templates", href: "/dashboard/templates", icon: FileText },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Rocket },
  { label: "Agent", href: "/dashboard/agent", icon: Bot },
];

function Mark() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden>
      <line x1="7" y1="13" x2="19" y2="13" stroke="var(--color-action)" strokeWidth="2.4" />
      <circle cx="7" cy="13" r="5" fill="var(--color-brand)" />
      <circle cx="19" cy="13" r="5" fill="#fff" stroke="var(--color-brand)" strokeWidth="2.4" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-full max-w-[240px] shrink-0 flex-col border-r border-line bg-white px-4 py-6">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2 font-display text-lg font-bold">
        <Mark /> LeadsKonnect
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((n) => {
          const active = n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-ink text-white" : "text-ink-soft hover:bg-tint hover:text-ink"
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/"
        className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-ink-soft hover:text-ink"
      >
        Back to site <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </aside>
  );
}
