/**
 * Lead-local quiet hours (product PRD §12 differentiator): throttle by each contact's
 * actual local time, not just a platform-wide volume cap. Timezone is estimated from the
 * phone's country code — necessarily approximate (large countries span multiple zones),
 * but the goal is narrow: don't message someone at 3am their time, not a precise clock.
 *
 * Scoped to WhatsApp (lib/channels/index.ts) — the one currently-live channel that
 * interrupts a phone; email sits in an inbox non-intrusively and isn't gated by this.
 */

// Longest prefix first, so "91" (India) is checked before a hypothetical single-digit
// clash — matters once more country codes are added here.
const COUNTRY_OFFSETS: { prefix: string; offsetMinutes: number }[] = [
  { prefix: "971", offsetMinutes: 240 }, // UAE
  { prefix: "91", offsetMinutes: 330 }, // India
  { prefix: "44", offsetMinutes: 60 }, // UK (BST-approximate; close enough for a quiet-hours gate)
  { prefix: "65", offsetMinutes: 480 }, // Singapore
  { prefix: "61", offsetMinutes: 600 }, // Australia (Sydney-approximate)
  { prefix: "27", offsetMinutes: 120 }, // South Africa
  { prefix: "49", offsetMinutes: 60 }, // Germany
  { prefix: "33", offsetMinutes: 60 }, // France
  { prefix: "81", offsetMinutes: 540 }, // Japan
  { prefix: "86", offsetMinutes: 480 }, // China
  { prefix: "1", offsetMinutes: -300 }, // US/Canada (ET-approximate)
].sort((a, b) => b.prefix.length - a.prefix.length);

const QUIET_START_HOUR = 21; // 9pm local
const QUIET_END_HOUR = 8; // 8am local

function estimateOffsetMinutes(phone: string | null | undefined): number | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "").replace(/^0+/, "");
  for (const c of COUNTRY_OFFSETS) {
    if (digits.startsWith(c.prefix)) return c.offsetMinutes;
  }
  return null;
}

/**
 * True if it's currently quiet hours (9pm-8am) at the contact's estimated local time.
 * An unknown timezone fails OPEN (never blocks) — a missed guess is better than never
 * messaging someone because we couldn't place them.
 */
export function isQuietHours(phone: string | null | undefined, now = new Date()): boolean {
  const offset = estimateOffsetMinutes(phone);
  if (offset === null) return false;
  const local = new Date(now.getTime() + offset * 60_000);
  const hour = local.getUTCHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}
