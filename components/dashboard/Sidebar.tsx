"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Users, Building2, Database, Radar, Rocket, FileText, Inbox, Bot,
  ListChecks, BarChart3, ShieldCheck, Phone, Video, Mail, Settings,
  CreditCard, Bell, Megaphone, MessagesSquare, Chrome, LogOut, ChevronsUpDown, Plus, Check,
  type LucideIcon,
} from "lucide-react";
import { signOut, useSession, authClient } from "@/lib/auth-client";

type NavItem = { label: string; href?: string; icon: LucideIcon; soon?: boolean };
type NavGroup = { title?: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { items: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Find & manage",
    items: [
      { label: "Contacts", href: "/dashboard/leads", icon: Users },
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

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  if (item.soon) {
    return (
      <div className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft/45" title="Coming soon">
        <item.icon className="h-4 w-4" />
        <span>{item.label}</span>
        <span className="ml-auto rounded-full bg-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-soft/55">Soon</span>
      </div>
    );
  }
  return (
    <Link
      href={item.href!}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink-soft hover:bg-tint hover:text-ink"
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />}
      <item.icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-full max-w-[240px] shrink-0 flex-col border-r border-line bg-white">
      {/* Logo — object-cover crops the wordmark's whitespace out of the 2:1 asset */}
      <Link href="/dashboard" aria-label="Followthroo home" className="flex shrink-0 items-center px-5 pb-2 pt-5">
        <span className="relative block h-8 w-40 overflow-hidden">
          <Image src="/logo.png" alt="Followthroo" fill sizes="160px" className="object-cover object-center" priority />
        </span>
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {GROUPS.map((group, gi) => (
          <div key={group.title ?? gi} className={group.title ? "pt-2" : ""}>
            {group.title && (
              <div className="px-3 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-soft/50">
                {group.title}
              </div>
            )}
            {group.items.map((item) => (
              <NavRow key={item.label} item={item} active={isActive(pathname, item.href)} />
            ))}
          </div>
        ))}
      </nav>

      <ProfileMenu />
    </aside>
  );
}

/* ---- Account / workspace dropdown (opens upward) ---- */
function ProfileMenu() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: org } = authClient.useActiveOrganization();
  const { data: orgs } = authClient.useListOrganizations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const email = session?.user?.email ?? "";
  const name = session?.user?.name?.trim() || email.split("@")[0] || "You";
  const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";

  async function switchOrg(id: string) {
    if (id === org?.id) return setOpen(false);
    await authClient.organization.setActive({ organizationId: id });
    window.location.reload();
  }
  async function createOrg() {
    const n = prompt("New workspace name?");
    if (!n?.trim()) return;
    const slug = `${n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await authClient.organization.create({ name: n.trim(), slug });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = (res.data as any)?.id;
    if (id) await switchOrg(id);
  }

  const link = (href: string, Icon: LucideIcon, label: string, soon?: boolean) =>
    soon ? (
      <div className="flex cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-soft/45">
        <Icon className="h-4 w-4" /> {label}
        <span className="ml-auto rounded-full bg-tint px-1.5 py-0.5 font-mono text-[9px] uppercase text-ink-soft/55">Soon</span>
      </div>
    ) : (
      <Link href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-tint hover:text-ink">
        <Icon className="h-4 w-4" /> {label}
      </Link>
    );

  return (
    <div ref={ref} className="relative shrink-0 border-t border-line p-3">
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 max-h-[70vh] origin-bottom overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-[0_20px_50px_-24px_rgba(20,20,20,0.4)]">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar initials={initials} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{name}</div>
              <div className="truncate text-xs text-ink-soft">{email}</div>
            </div>
          </div>

          <div className="my-1 h-px bg-line" />
          {link("/dashboard/settings", Settings, "Settings")}
          {link("/dashboard/settings/billing", CreditCard, "Plans & billing")}
          {link("/dashboard/settings/notifications", Bell, "Notifications")}
          {link("/dashboard/templates", FileText, "Templates")}

          <div className="my-1 h-px bg-line" />
          {link("/changelog", Megaphone, "Product updates")}
          {link("/contact", MessagesSquare, "Share feedback")}
          {link("/dashboard/settings/linkedin", Chrome, "Install Chrome extension")}

          <div className="my-1 h-px bg-line" />
          <div className="px-2.5 pb-1 pt-1 font-mono text-[10px] uppercase tracking-wide text-ink-soft/50">Workspace</div>
          {(orgs ?? []).map((o) => (
            <button key={o.id} onClick={() => switchOrg(o.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-tint">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-tint text-[10px] font-bold">{o.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
              {o.id === org?.id && <Check className="h-4 w-4 text-accent" />}
            </button>
          ))}
          <button onClick={createOrg} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-tint hover:text-ink">
            <Plus className="h-4 w-4" /> New workspace
          </button>

          <div className="my-1 h-px bg-line" />
          <button onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/sign-in") } })} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-tint hover:text-ink">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}

      <button onClick={() => setOpen((v) => !v)} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${open ? "bg-tint" : "hover:bg-tint"}`}>
        <Avatar initials={initials} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs text-ink-soft">{org?.name ?? "Workspace"}</span>
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-strong">Free</span>
          </div>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-soft" />
      </button>
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
      {initials}
    </span>
  );
}
