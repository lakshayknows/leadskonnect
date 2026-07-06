/**
 * Deliverability metrics — derived from warm-up placement (inbox vs spam), lemwarm-style.
 * Per-mailbox score = inbox / received. Overall = mean across mailboxes with data.
 */
import { prisma } from "./db";

export interface MailboxDeliverability {
  id: string;
  name: string;
  email: string;
  provider: string;
  warmupEnabled: boolean;
  dailyTarget: number;
  score: number | null;
  sent: number;
  received: number;
  inbox: number;
  spam: number;
  rescued: number;
}
export interface DeliverabilityData {
  days: number;
  overall: { score: number | null; inbox: number; spam: number; sent: number; received: number };
  mailboxes: MailboxDeliverability[];
}

const DAY = 86_400_000;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

export async function getDeliverability(orgId: string, days = 30): Promise<DeliverabilityData> {
  const since = new Date(Date.now() - days * DAY);
  const [accounts, events] = await Promise.all([
    prisma.sendingAccount.findMany({ where: { organizationId: orgId }, include: { warmup: true } }),
    prisma.warmupEvent.findMany({
      where: { organizationId: orgId, at: { gte: since } },
      select: { sendingAccountId: true, direction: true, placement: true, rescued: true },
    }),
  ]);

  const acc = new Map<string, { sent: number; received: number; inbox: number; spam: number; rescued: number }>();
  for (const a of accounts) acc.set(a.id, { sent: 0, received: 0, inbox: 0, spam: 0, rescued: 0 });
  for (const e of events) {
    const b = acc.get(e.sendingAccountId);
    if (!b) continue;
    if (e.direction === "sent") b.sent++;
    else {
      b.received++;
      if (e.placement === "inbox") b.inbox++;
      else if (e.placement === "spam") b.spam++;
      if (e.rescued) b.rescued++;
    }
  }

  const mailboxes: MailboxDeliverability[] = accounts.map((a) => {
    const b = acc.get(a.id)!;
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      provider: a.provider,
      warmupEnabled: a.warmup?.enabled ?? false,
      dailyTarget: a.warmup?.dailyTarget ?? 6,
      score: pct(b.inbox, b.received),
      ...b,
    };
  });

  const scored = mailboxes.filter((m) => m.score !== null);
  const overallScore = scored.length ? Math.round(scored.reduce((s, m) => s + (m.score ?? 0), 0) / scored.length) : null;
  const overall = {
    score: overallScore,
    inbox: mailboxes.reduce((s, m) => s + m.inbox, 0),
    spam: mailboxes.reduce((s, m) => s + m.spam, 0),
    sent: mailboxes.reduce((s, m) => s + m.sent, 0),
    received: mailboxes.reduce((s, m) => s + m.received, 0),
  };

  return { days, overall, mailboxes };
}
