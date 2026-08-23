# channels.md — Per-Channel Features & Official Limits

**Last updated:** 2026-08-11
**Status:** draft

> Every channel module implements a uniform `send(lead, rendered)` interface and goes
> through `lib/ratelimit`. Consolidated numbers live in [rate-limits.md](rate-limits.md).

---

## Email

**Stack:** Nodemailer (SMTP, no heavy deps) or Gmail API. Optional SendGrid/Mailgun
for high volume.

**Features**
- TLS/STARTTLS, **OAuth2** for Gmail/Exchange, **DKIM signing**, attachments,
  HTML + text bodies.
- Template variables (`{{firstName}}`, `{{companyName}}`, …) with fallbacks.
- Bounce/spam tracking via webhooks or IMAP; suppression on hard bounce.

**Deliverability requirements**
- Authenticate the sending domain: **SPF + DKIM** (Nodemailer supports DKIM),
  ideally DMARC.
- Warm up new domains/accounts; monitor bounce + spam rates (Google throttles on
  poor reputation).

**Limits (Gmail/Workspace)**
- Free/trial: **500 messages/day**. Paid Workspace: **~2,000/day**.
- External recipients capped (e.g. ~3,000/day outside your domain); ≤500 recipients
  per message; rolling 24h window.
- Practical throttle: queue + pause (~40 emails/hour) to avoid blocks. Full strategy
  in [rate-limits.md](rate-limits.md).

### Who a message goes out as (2026-08-11)

**Every message a contact receives leaves through a `SendingAccount` the workspace
connected itself.** There is no platform fallback mailbox, and re-adding one would
reintroduce four problems at once:

- mail left under Followthroo's `MAIL_FROM` rather than the customer's domain, while
  the body was still signed with the rep's name;
- the reply poller only walks `SendingAccount` rows, so replies to that mailbox were
  **never captured** — stop-on-reply never fired, the Inbox stayed empty, and no
  follow-up task was ever created;
- deliverability reputation was shared across every tenant, and the Deliverability
  page (keyed on `sendingAccountId`) could not score it;
- the rate limiter keys on `(org, account)`, so each tenant got a *separate* quota
  against one physical mailbox — N orgs × 40/hour through a single account.

A send with no connected account now fails loudly with a reason the UI shows.

`SMTP_*` / `MAIL_FROM` still exist, for exactly one purpose: `sendSystemEmail()` in
`lib/channels/email.ts`, which is Followthroo mailing **its own users** (new-lead
alerts, SLA escalations). It is a separate function from `emailChannel.send` so the
line can't blur, and nothing it sends is ever addressed to a lead.

**Tenant scoping:** an account id is a bare uuid, so every lookup is
`findFirst({ id, organizationId })` and `orgId` is part of the adapter's `send()`
signature. `/api/campaigns` (POST + PATCH) and `/api/agent` verify the submitted
account belongs to the caller before attaching it. Guarded by
`scripts/verify-sending.ts`.

---

## LinkedIn

**Reality:** LinkedIn is stringent. Automation of a personal account is a gray area
that violates LinkedIn's terms and risks restriction. Use with extreme care.

**Options**
- **Official API** — only **company/organization pages** are cleanly supported
  (`w_organization_social_feed` for admins). Personal-account actions need
  `w_member_social_feed`, granted **only to approved partners**.
- **Browser automation** (Puppeteer/Playwright) to click Connect / send messages as a
  logged-in user. Fragile, TOS-sensitive; preserve session cookies securely, use a
  stable IP.

**Limits & humanization**
- Start at **~20 invites/day** for a new account; ramp gradually with acceptance rate
  (e.g. +5/week). Hidden caps trigger "Try again next week."
- Randomize delays, interleave organic actions (profile visits, likes), stop on
  "out of invites." Never burst. Consider multiple accounts with distinct IPs only if
  compliant with your risk posture.

---

## WhatsApp

**Stack:** Official **WhatsApp Business API** via **Twilio** (Node/Python SDK) or
Meta's API directly.

**Rules**
- Messages outside the **24-hour** customer service window must use **pre-approved
  templates**, and require prior **opt-in**.
- Respect the **quality rating** — throttle or fall back if quality drops to negative.

**Limits (messaging tiers, per business portfolio)**
- New account: **250 unique users / 24h**, shared across all numbers in the portfolio.
- Auto-scales **250 → 2,000 → 10,000 → 100,000** after business verification / sending
  high-quality messages. Twilio default: 250 contacts/day, upgradable via Meta's
  scaling program.
- Track unique recipients in a rolling 24h; queue overflow to the next day.

---

## Social comments

Posting comments/replies on social posts. Prefer official APIs; fall back to careful
browser automation with randomized timing only where TOS allows.

| Platform | API surface | Notes |
|---|---|---|
| LinkedIn | Comments API — **organization posts** only; personal limited (`w_member_social_feed`) | OAuth app; same partner restriction |
| Twitter/X | API v2 tweets/replies | Recent pricing changes; check current tier |
| Facebook | Graph API page comments (user token) | Per-app rate limits |
| Instagram | Business API commenting on **business** posts | OAuth; business account required |

**Rule:** heed each platform's TOS + rate limits; add natural delays; never mass-spam.

---

## Uniform module contract

```ts
// lib/channels/<name>/index.ts
export interface Channel {
  send(lead: Lead, rendered: RenderedMessage): Promise<SendResult>;
  // must acquire quota from lib/ratelimit before sending
  // must write messages + activity_log on completion
}
```

---

## Deliverability & tracking (Phase 2 — 2026-07-05)

- **Open/click tracking** (`lib/tracking.ts`): before each email send, `job-processor`
  pre-generates the `Message` id, rewrites `http(s)` links to `/api/track/click/[messageId]`
  and appends a 1×1 pixel at `/api/track/open/[messageId]`. Both routes are unauthenticated,
  resolve the org from the `Message`, write an `ActivityLog(opened|clicked)` (with `messageId`),
  and — for clicks — 302 to the original URL. Feeds Reports and the campaign `condition`
  nodes (`opened` / `clicked`).
- **Reports** (`/dashboard/reports`, `lib/reports.ts`): funnel, engagement time series,
  per-campaign breakdown, open/click/reply rates (Recharts).
- **Mailbox warm-up** (`lib/warmup.ts`): enabled mailboxes in an org email each other on a
  ramping daily schedule (`/api/warmup/run`, cron every 4h). The reply poller
  (`lib/inbox/poller.ts`) recognizes warm-up mail (sender is one of the org's own mailboxes),
  records `WarmupEvent` placement (inbox/spam) and **rescues spam** via Gmail `messages.modify`.
- **Deliverability** (`/dashboard/deliverability`, `lib/deliverability.ts`): per-mailbox
  score = inbox/received; toggle warm-up + daily target per mailbox.
- **Per-account DKIM**: `SendingAccount.dkim{Domain,Selector,PrivateKey}` now sign per-account
  SMTP sends (previously only the env default transport was signed).
- **Gmail scope**: connecting a Gmail account now requests `gmail.modify` (read + label
  changes) in addition to `gmail.send`. Accounts connected before this must reconnect for
  reply polling + warm-up placement/rescue to work.

---

## LinkedIn — companion Chrome extension, human-assisted (Phase 5 — updated)

LinkedIn does **not** grant connection-invite or DM access through its developer program,
and its User Agreement (§8.2) prohibits bots or automated methods for connections/messages
outright. So this is deliberately **not** autonomous: a companion Chrome extension drafts
each action from the user's own logged-in LinkedIn session, in their browser, but a human
reviews and clicks Send themselves — the extension never does.

**Flow:**
1. A campaign `send` node with `channel: "linkedin"` → `lib/channels/linkedin.ts` enqueues a
   `LinkedInAction` (it no longer no-ops).
2. The extension (`extension/`, MV3) polls `GET /api/linkedin/queue` (auth: per-member
   `LinkedInAccount.extToken`), claims one action, opens the profile in a **foregrounded**
   tab, and fills the invite note / message box via injected DOM automation — then stops.
   It reports `status: "drafted"` back so the queue/cap accounting sees it as in-flight.
3. The human reviews what's filled, sends it themselves in that tab, then confirms **"I
   sent it"** (or **Skip**) in the extension popup — only that confirmation
   `POST /api/linkedin/queue`s the terminal outcome, recorded as a `Message` +
   `ActivityLog` + `ConversationEvent` (visible in reports/timeline). Polling stays paused
   on one drafted action at a time until the human resolves it, then waits a randomized
   `min–maxDelaySec` before drafting the next.

**Caps + safety:** daily invite cap enforced server-side in `lib/linkedin/queue.ts`
(`claimActions`, now counting `drafted` toward the cap too); the extension drafts one
action per tick (default 45–120s apart); stale in-progress claims are auto-reclaimed after
15 min, stale drafted ones (human never came back) after 40 min. Config + token live at
`/dashboard/settings/linkedin`.

**⚠️ ToS:** drafting from a personal LinkedIn account is still automation-adjacent even
with a human sending — keep caps conservative (≤ ~20 invites/day), warm up new accounts,
don't leave large batches queued unattended. The official "Sign in with LinkedIn (OIDC)" +
"Share on LinkedIn" APIs remain available for identity/posting and can be wired separately.
