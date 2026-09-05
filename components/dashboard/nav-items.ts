import {
  LayoutDashboard, Users, Rocket, FileText, Inbox,
  ListChecks, BarChart3, Settings, GitBranch, Linkedin,
  type LucideIcon,
} from "lucide-react";
import type { TourTargetId } from "./tour/target";

export type NavItem = { label: string; href?: string; icon: LucideIcon; soon?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

/**
 * Single source of truth for dashboard navigation — the desktop rail and the
 * mobile drawer both read it, so they can't drift apart.
 *
 * Kept deliberately short. A salesperson thinks in terms of who to contact, who
 * they're talking to, who needs following up and what's open — not in terms of
 * the modules a CRM happens to have. Everything that used to sit here and no
 * longer does is still reachable, one level in:
 *
 *   Deliverability / Ageing / Escalations / Control tower → Reports (AnalyzeNav)
 *   Sending accounts                                      → Settings
 *   Companies                                             → Leads, grouped
 *   Test emails                                           → Templates
 *
 * Nothing was deleted; the rail just stopped being the index of the codebase.
 *
 * Three rows left on 2026-09-05, taking it from 13 to 10:
 *
 *   - **Companies** was 69 lines: a search box over leads grouped by company.
 *     Its own empty state admitted as much. It is a way of looking at leads, not
 *     a separate noun.
 *   - **Test emails** is a harness for checking a model change against one lead
 *     — CLAUDE.md says so explicitly. An internal tool should not have equal
 *     billing with Inbox.
 *   - **Calendar** was a `soon: true` stub. A row that cannot be clicked is a
 *     promise, and the rail is not where promises go.
 */
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ label: "Home", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Sales",
    items: [
      { label: "Leads", href: "/dashboard/leads", icon: Users },
      { label: "Pipeline", href: "/dashboard/pipeline", icon: GitBranch },
    ],
  },
  {
    title: "Communicate",
    items: [
      { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
      { label: "Tasks", href: "/dashboard/tasks", icon: ListChecks },
    ],
  },
  {
    title: "Automate",
    items: [
      { label: "Campaigns", href: "/dashboard/campaigns", icon: Rocket },
      { label: "LinkedIn", href: "/dashboard/linkedin", icon: Linkedin },
      { label: "Templates", href: "/dashboard/templates", icon: FileText },
    ],
  },
  {
    title: "Analyze",
    items: [{ label: "Reports", href: "/dashboard/reports", icon: BarChart3 }],
  },
  {
    items: [{ label: "Settings", href: "/dashboard/settings", icon: Settings }],
  },
];

/** Nav rows the product tour points at, keyed by label so this file stays the
 *  single source of ordering and grouping. */
export const NAV_TOUR_TARGETS: Record<string, TourTargetId> = {
  Leads: "sidebar-contacts",
  Campaigns: "sidebar-campaigns",
  Inbox: "sidebar-inbox",
  Tasks: "sidebar-tasks",
};

export function isActiveHref(pathname: string, href?: string) {
  if (!href) return false;
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}
