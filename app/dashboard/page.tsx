import Link from "next/link";
import { Mail, Linkedin, MessageCircle, MessagesSquare, Users, Send, Reply, Rocket, ArrowRight } from "lucide-react";

const CHANNELS = [
  { name: "Email", icon: Mail, limit: "40/hr · 500–2,000/day", color: "var(--color-ch-email)" },
  { name: "LinkedIn", icon: Linkedin, limit: "~20 invites/day", color: "var(--color-ch-linkedin)" },
  { name: "WhatsApp", icon: MessageCircle, limit: "250 unique/24h", color: "var(--color-ch-whatsapp)" },
  { name: "Social", icon: MessagesSquare, limit: "on-brand", color: "var(--color-ch-social)" },
];

const STATS = [
  { label: "Leads", value: "—", icon: Users },
  { label: "Sent today", value: "—", icon: Send },
  { label: "Reply rate", value: "—", icon: Reply },
  { label: "Active campaigns", value: "—", icon: Rocket },
];

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] glow-brand" />

      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16">
        {/* Header */}
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="eyebrow">Command center</span>
            <h1 className="font-display mt-2 text-4xl font-extrabold sm:text-5xl">Dashboard</h1>
          </div>
          <Link href="#" className="btn btn-primary">
            New campaign <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <s.icon className="mb-3 h-5 w-5 text-brand" />
              <div className="font-display text-3xl font-bold">{s.value}</div>
              <div className="font-mono text-xs uppercase tracking-wide text-ink-soft">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Channels */}
        <div className="mt-12 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Channels</h2>
          <span className="font-mono text-xs text-ink-soft">rate-limited by default</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((c) => (
            <div
              key={c.name}
              className="group rounded-2xl border border-line bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                style={{ background: c.color }}
              >
                <c.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-semibold">{c.name}</div>
              <div className="mt-1 font-mono text-xs text-ink-soft">{c.limit}</div>
            </div>
          ))}
        </div>

        <p className="mt-14 text-sm text-ink-soft">
          Suppression + rate limits enforced in <code className="rounded bg-tint px-1.5 py-0.5 font-mono text-xs text-brand-ink">lib/channels/safeSend</code>. Configure
          credentials in <code className="rounded bg-tint px-1.5 py-0.5 font-mono text-xs text-brand-ink">.env.local</code>.
        </p>
      </div>
    </main>
  );
}
