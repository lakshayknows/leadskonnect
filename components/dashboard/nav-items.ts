import {
  LayoutDashboard, Users, Building2, Database, Radar, Rocket, FileText, Inbox, Bot,
  ListChecks, BarChart3, ShieldCheck, Phone, Video, Mail, Settings, GitBranch, AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import type { TourTargetId } from "./tour/target";

export type NavItem = { label: string; href?: string; icon: LucideIcon; soon?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

/**
 * Single source of truth for dashboard navigation — the desktop rail and the
 * mobile drawer both read it, so they can't drift apart.
 */
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Find & manage",
    items: [
      { label: "Contacts", href: "/dashboard/leads", icon: Users },
      { label: "Pipeline", href: "/dashboard/pipeline", icon: GitBranch },
      { label: "Companies", href: "/dashboard/companies", icon: Building2 },
      { label: "People database", icon: Database, soon: true },
      { label: "Signal agents", icon: Radar, soon: true },
    ],
  },
  {
    title: "Engage",
    items: [
      { label: "Campaigns", href: "/dashboard/campaigns", icon: Rocket },
      { label: "Templates", href: "/dashboard/templates", icon: FileText },
      { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
      { label: "AI agent", href: "/dashboard/agent", icon: Bot },
      { label: "Tasks", icon: ListChecks, soon: true },
    ],
  },
  {
    title: "Analyze",
    items: [
      { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
      { label: "Deliverability", href: "/dashboard/deliverability", icon: ShieldCheck },
      { label: "Ageing", href: "/dashboard/ageing", icon: AlertTriangle },
      { label: "Calls", icon: Phone, soon: true },
      { label: "Meetings", icon: Video, soon: true },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "Sending accounts", href: "/dashboard/accounts", icon: Mail },
      { label: "Settings & team", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

/** Nav rows the product tour points at, keyed by label so this file stays the
 *  single source of ordering and grouping. */
export const NAV_TOUR_TARGETS: Record<string, TourTargetId> = {
  Contacts: "sidebar-contacts",
  Campaigns: "sidebar-campaigns",
  Inbox: "sidebar-inbox",
  "Sending accounts": "sidebar-accounts",
};

export function isActiveHref(pathname: string, href?: string) {
  if (!href) return false;
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}
