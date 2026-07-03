import Link from "next/link";
import { Mail, Linkedin, MessageCircle, MessagesSquare, Users, Send } from "lucide-react";

const CHANNELS = [
  { name: "Email", icon: Mail, limit: "40/hr · 500–2,000/day", href: "/dashboard/channels/email" },
  { name: "LinkedIn", icon: Linkedin, limit: "~20 invites/day", href: "/dashboard/channels/linkedin" },
  { name: "WhatsApp", icon: MessageCircle, limit: "250 unique/24h", href: "/dashboard/channels/whatsapp" },
  { name: "Social", icon: MessagesSquare, limit: "per-platform", href: "/dashboard/channels/social" },
];

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-16">
        {/* Header */}
        <header className="mb-16 flex flex-col items-center text-center">
          <span className="mb-3 text-xs uppercase tracking-[0.3em] text-white/40">LeadsKonnect</span>
          <h1
            className="text-white"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.5rem, 5vw, 3.5rem)" }}
          >
            Command Center
          </h1>
          <p className="mt-4 max-w-xl text-white/60">
            One clear, consistent story across every channel — throttled, humanized, and safe by default.
          </p>
        </header>

        {/* Stat row */}
        <div className="mb-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Leads", value: "—", icon: Users },
            { label: "Sent today", value: "—", icon: Send },
            { label: "Reply rate", value: "—", icon: Mail },
            { label: "Active campaigns", value: "—", icon: MessagesSquare },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <s.icon className="mb-3 h-5 w-5 text-white/40" />
              <div className="text-2xl font-medium">{s.value}</div>
              <div className="text-xs uppercase tracking-wide text-white/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Channels */}
        <h2 className="mb-6 text-center text-sm uppercase tracking-[0.2em] text-white/40">Channels</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((c) => (
            <Link
              key={c.name}
              href={c.href}
              className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/25 hover:bg-white/[0.04]"
            >
              <c.icon className="mb-4 h-6 w-6 text-white/70 transition-colors group-hover:text-white" />
              <div className="text-lg font-medium">{c.name}</div>
              <div className="mt-1 text-xs text-white/40">{c.limit}</div>
            </Link>
          ))}
        </div>

        <p className="mt-16 text-center text-xs text-white/30">
          Rate limits enforced in <code className="text-white/50">lib/ratelimit</code>. Configure credentials in{" "}
          <code className="text-white/50">.env.local</code>.
        </p>
      </div>
    </main>
  );
}
