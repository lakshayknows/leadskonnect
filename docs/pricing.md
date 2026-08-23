# pricing.md — Recurring Costs & Pricing Setup

**Last updated:** 2026-08-14
**Status:** draft

> This doc grounds a proposed pricing structure (Free/Startup/Growth/Enterprise
> tiers, seat-based subscription + usage-based "Followthroo Credits" for
> communications) in this codebase's actual infrastructure choices, so pricing
> decisions are based on real COGS rather than generic SaaS assumptions. It
> supplements the tier structure — it does not redesign it.
>
> **Interactive model:** [pricing-model.xlsx](pricing-model.xlsx) turns the
> margin math below into a live workbook — an editable Assumptions tab (FX
> rate, tier prices, AI $/seat, plan mix, payment %) feeds four scenario
> sheets (Blended Mix, All Startup, All Growth, All Enterprise), each showing
> revenue/cost/margin at 10 → 25 → 50 → 100 → 250 → 500 → 1,000 seats.
> [pricing-model-blended.csv](pricing-model-blended.csv) is a flat export of
> the primary Blended Mix scenario for quick viewing.

---

## Why this looks different from a typical outreach SaaS

Three architecture decisions already made in this repo change the cost
picture materially versus what you'd assume from a generic multi-channel
outreach platform:

1. **Email costs ~$0 to send.** Every send goes through a tenant-connected
   `SendingAccount` (Nodemailer + Gmail OAuth2/SMTP) — there is deliberately
   **no platform fallback mailbox** (`docs/channels.md`), to avoid
   shared-reputation and cross-tenant rate-limit problems. The customer's own
   Gmail/Workspace account absorbs the sending cost, not Followthroo.
2. **LinkedIn automation costs ~$0 server-side.** It is not headless-browser
   automation. It's a Chrome extension (`extension/`) that runs in the rep's
   own browser, on their own logged-in session; a human reviews and clicks
   Send. No headless-browser hosting, no proxy pool, no anti-detection infra
   to budget for.
3. **Auth costs $0 in per-MAU fees.** The app uses self-hosted `better-auth`
   (email/password + Google OAuth + an org plugin), not Clerk or Auth0 as
   `docs/security.md` and `CLAUDE.md` still state — that's a stale reference,
   worth fixing separately, but the actual build already avoided the
   per-monthly-active-user auth SaaS fee.

The real variable cost driver is **AI token usage**, with **WhatsApp**
pass-through a distant second. Both are already contemplated by the
"Followthroo Credits" usage-metering idea — this doc just puts numbers behind
it.

---

## What's actually running (as of this branch)

| Layer | Provider | Notes |
|---|---|---|
| Hosting | Vercel (Fluid Compute) | `.vercel/project.json` confirms the connection; no `vercel.json` yet |
| Database | Supabase Postgres | Pooled `:6543` (runtime, pgbouncer) / direct `:5432` (migrations) |
| Queue (prod) | Upstash QStash | `lib/queue.ts`: QStash → BullMQ/Redis fallback → inline (dev only) |
| Rate-limit counters | Upstash Redis | Required in prod so counters are shared across workers (`lib/ratelimit.ts`) |
| Email | Nodemailer + Gmail OAuth2/SMTP | BYO mailbox per tenant, no shared fallback |
| WhatsApp | Twilio | Real integration in `package.json`, needs creds to go live |
| LinkedIn | Chrome extension (`extension/`) | Human-assisted, runs client-side in the rep's browser |
| AI — main agent loop | `claude-opus-5` via `@anthropic-ai/sdk` | `docs/ai-agent.md` / `lib/env.ts` default (`ANTHROPIC_MODEL`) |
| AI — reply classifier | `claude-haiku-4-5` | Fires on **every inbound reply**, across every channel (`ANTHROPIC_CLASSIFIER_MODEL`) |
| Auth | `better-auth`, self-hosted | Email/password + Google OAuth + org plugin |
| Billing | **Nothing built yet** | `app/dashboard/settings/billing/page.tsx` and `app/pricing/page.tsx` are static, hardcoded, mutually-inconsistent mockups. No Stripe/Razorpay integration. No `Plan`/`Subscription`/`Credit` model in `prisma/schema.prisma`. |

---

## Current unit pricing

Pulled live on 2026-08-14 — re-verify before finalizing anything against these
numbers, since infra and platform pricing drifts.

| Item | Rate | Source |
|---|---|---|
| Claude Opus 5 (`claude-opus-5`) | $5.00 / $25.00 per MTok (input/output) | Anthropic API pricing (cached 2026-06-24, authoritative) |
| Claude Haiku 4.5 (`claude-haiku-4-5`) | $1.00 / $5.00 per MTok (input/output) | Anthropic API pricing |
| Vercel Pro | $20/seat/month, includes a matching $20 usage credit (does **not** multiply with seats); 1TB transfer + 10M edge requests free | Vercel pricing, Aug 2026 |
| Supabase Pro | $25/month base + $10 compute credit (covers 1 micro instance, 2-core ARM/1GB RAM); real-world small/medium apps land $35–75/mo once usage is counted | Supabase pricing, Aug 2026 |
| Upstash Redis | $0.20 / 100K commands + $0.25/GB storage, pay-per-request, scale-to-zero | Upstash pricing, Aug 2026 |
| Upstash QStash | $1 / 100K messages + $0.25/GB storage | Upstash pricing, Aug 2026 |
| Meta WhatsApp (India, per-message since Jul 2025) | Marketing ₹0.863, Utility ₹0.115, Authentication ₹0.115. Service replies free today — **becomes chargeable (₹0.115) from Oct 1, 2026** | Meta WhatsApp Business Platform rate card, Aug 2026 |
| Twilio WhatsApp markup | $0.005 flat per message, inbound or outbound | Twilio pricing, Aug 2026 |
| Razorpay | ~2% + 18% GST (≈2.36% effective) domestic card/netbanking, +0.99% subscription fee on recurring/auto-pay billing → **~2.5–4% of revenue** all-in | Razorpay pricing, Aug 2026 |

---

## Recurring cost model

### A. Fixed platform infra

Scales with total data/traffic across all tenants, not linearly per seat.
Modeled at two illustrative scale points rather than one guess:

| | Pilot (~10 orgs, ~60 paid seats) | Early growth (~40 orgs, ~300 paid seats) |
|---|---|---|
| Vercel | $40–60/mo | $150–350/mo |
| Supabase | $35–60/mo | $100–250/mo (bigger compute instance + PITR backups recommended for the tamper-evident compliance ledger) |
| Upstash (Redis + QStash) | $5–20/mo | $40–120/mo |
| Monitoring (not yet added — recommend Sentry) | $0 (defer) | $26–80/mo |
| **Total** | **~$85–225/mo** | **~$290–830/mo** |

The "early growth" scale point matches the consultant's plan minimums (Startup
3-seat min, Growth 5-seat min) at roughly 40 paying orgs.

### B. Per-seat variable COGS

This is the real driver, and it's small relative to the proposed price
points:

- **AI** — modeled bottom-up: agent-loop invocations/user/month × blended
  Claude Opus 5 cost (with prompt caching) + classifier calls/user/month ×
  Claude Haiku 4.5 cost. Comes out to roughly **$2–4/user/month** at
  Startup-tier usage, **$4–8/user/month** at Growth/Enterprise "Advanced AI"
  usage (more agentic automation → more tool-loop invocations). **This is a
  model, not measured data** — replace with real per-org token usage
  (Anthropic's `usage` object) within the first 1–2 months live.
- **WhatsApp** — pure pass-through: ~₹0.55/message (utility, Meta + Twilio) to
  ~₹1.30/message (marketing). Must be billed through the credits mechanism
  with a markup, never bundled as "unlimited" — this validates the
  consultant's structural call on communications billing.
- **Email** — ~$0 (BYO mailbox architecture, see above).
- **LinkedIn** — ~$0 server-side (Chrome-extension architecture, see above).
- **Payment processing** — ~2.5–4% of collected revenue (Razorpay).

### Margin check against the proposed tiers

Per-seat COGS built up from the three components above, at ₹87 ≈ $1 and using
the "early growth" scale point (300 seats) for infra allocation — that's the
steady-state operating scale, not the pilot, since per-seat infra cost
improves with scale as fixed costs amortize:

| Component | Startup (Basic AI) | Growth (Advanced AI) |
|---|---|---|
| AI (Opus 5 + Haiku 4.5) | $2–3/user → ₹175–260 | $4–8/user → ₹350–700 |
| Infra allocation (₹290–830 total ÷ 300 seats) | ₹85–240 | ₹85–240 (a bit higher in practice — heavier automation load — say ₹100–280) |
| Payment processing (Razorpay, ~3% blended) | ₹30 | ₹75 |
| **Total COGS/user** | **≈ ₹290–530** | **≈ ₹525–1,055** |

| Tier | Price | COGS/user (range above) | Gross margin (range) |
|---|---|---|---|
| Startup | ₹999/user/month | ₹290–530 | **~47–71%**, roughly 55–65% at the middle of the range |
| Growth | ₹2,499/user/month | ₹525–1,055 | **~58–79%**, roughly 68–75% at the middle of the range |
| Enterprise | ₹4,999/user/month | Same per-seat drivers, larger denominator | Comfortably **>75%**, room to absorb dedicated support/SSO/custom-AI costs |

The ranges are wide because AI usage is a *model*, not measured data — that's
the single biggest lever on actual margin, by a wide margin over infra or
payment fees. What the range does establish reliably: Growth's margin sits
meaningfully above Startup's under every combination of assumptions, because
the AI-cost increase from Basic → Advanced usage (roughly 2x) is smaller than
the price increase from ₹999 → ₹2,499 (roughly 2.5x).

**Conclusion:** the consultant's tier prices and the seat-plus-metered-usage
structure are cost-sound — Growth at ₹2,499 is correctly the highest-margin,
recommended hero tier, and even the worst-case Startup margin (~47%) is
survivable for a seat-based SaaS line as long as WhatsApp/SMS/Voice stay
metered separately rather than bundled. The number worth tightening once
live, before trusting these margins for real financial planning, is AI usage
per seat — replace the $2–8/user assumption with measured token usage from
the `usage` object on real traffic within the first 1–2 months.

---

## Gaps to close before this is chargeable

Not addressed in this pass — real engineering scope, listed here so it isn't
lost:

1. **Razorpay Subscriptions + a Credits ledger table** — org-scoped, tracks
   AI/WhatsApp/SMS/Voice usage against each plan's allowance.
2. **Per-org usage metering** on the two call sites that already exist: the AI
   agent loop (`lib/agent.ts`) and the WhatsApp send path
   (`lib/channels/whatsapp.ts`).
3. **Meta's Oct 1, 2026 WhatsApp pricing change** (service/utility messages
   inside the session window become chargeable) should be built into the
   credit rate card now, not scrambled later.
4. **Stale model references** — `CLAUDE.md`, `ROADMAP.md`, and `SETUP.md`
   still say `claude-opus-4-8`; `docs/ai-agent.md` and the actual code
   (`lib/env.ts`) already agree on `claude-opus-5`. Small, unrelated to
   pricing, but noticed during this audit.
