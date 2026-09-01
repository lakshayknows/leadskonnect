# CLAUDE.md — LeadsKonnect (Multi-Channel Outreach Platform)

> Master context file. Claude Code reads this every session. If it conflicts with
> what you see in code, trust the code and update this file.

**Last updated:** 2026-08-11
**Status:** draft

---

## What we are building

An AI-powered **multi-channel outreach platform**. Think of it as conducting a
multi-instrument symphony — each channel (Email, LinkedIn, WhatsApp, social comments)
plays its own part, yet must sync perfectly. The system automates personalized
outreach across channels, tracks every lead and interaction in a CRM, respects every
platform's rate limits, and is driven by a Claude agent that orchestrates the
sequence. A premium Next.js UI sits on top.

## Tech stack (assumed by all docs)

| Layer | Choice |
|---|---|
| App framework | **Next.js (App Router)** — full-stack; API routes + server actions |
| Language | **TypeScript** everywhere |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite` / Next integration) |
| Animation | Standard **`requestAnimationFrame`** (60fps carousel) + **motion / Framer Motion** (scroll reveals) |
| Icons | **Lucide React** |
| Email | **Nodemailer** / Gmail API (OAuth2, DKIM/SPF); optional SendGrid/Mailgun for volume |
| WhatsApp | **Twilio** Programmable Messaging (or Meta Business API) |
| LinkedIn | Official REST API where possible; else Puppeteer/Playwright browser automation (careful) |
| Data | **PostgreSQL** (or HubSpot CRM via API) |
| Jobs/queues | **BullMQ** (throttling, scheduling, retries) |
| Auth | Auth0 / Clerk for user login; per-service OAuth2 server-to-server |
| Deploy | Vercel (Fluid Compute; Node 24 LTS) |

## Repo conventions

- `app/` — Next.js routes (UI + API). `app/api/<channel>/…` for channel endpoints.
- `lib/channels/{email,linkedin,whatsapp,social}/` — per-channel logic.
- `lib/crm/`, `lib/templates/`, `lib/agent/`, `lib/ratelimit/` — cross-cutting modules.
- `components/` — UI. The four supplied assets live under `components/marketing/`.
- Secrets only via env / vault — **never** in source. See `docs/security.md`.

## Hard rules (guardrails — do not violate)

- **Rate limits are law.** Gmail ≤500/day free · ≤2,000/day paid Workspace;
  LinkedIn ~20 invites/day (ramp slowly); WhatsApp 250 unique/24h (tiers up after
  verification). Full table: `docs/rate-limits.md`.
- **Throttle + humanize** all automation: queue everything, add random jitter
  (30–90s between actions), warm up new accounts. Never burst.
- **No secrets in source, logs, or client code.** Least-privilege tokens, rotation,
  vault. See `docs/security.md`.
- **Respect consent & opt-out.** Maintain a suppression list; honor unsubscribe and
  GDPR deletion. WhatsApp requires opt-in + approved templates.
- **Design system is binding.** Follow `design_constraints.md` — especially the
  white-on-`#FF0000` contrast rule (fails AA for body text).
- **The sidebar is not an index of the codebase.** New surfaces go *inside* an
  existing screen — a tab, a dialog, a sub-nav row, a panel on the lead record —
  unless they serve one of the five questions in `docs/information-architecture.md`.
  The rail went from 18 rows to 11 for a reason; don't grow it back.
- **The user never needs to understand the integration.** A lead is a lead whether it
  came from IndiaMART, Meta Ads or a CSV; the source is metadata, never a destination.
- **Never take payment for a domain.** The reseller storefront charges the customer and
  credits us the margin — a checkout in the app would bill them twice. See
  `docs/domains-and-mailboxes.md` before touching anything in `lib/domains/`.
- **The agent layer runs through OpenRouter**, via its Anthropic-compatible
  endpoint, so one SDK and one wire format serve every model. The model is
  `OPENROUTER_MODEL` (provider-prefixed ids, e.g. `minimax/minimax-m2`,
  `anthropic/claude-...`) and failover is `OPENROUTER_FALLBACK_MODELS` — not a
  second provider integration. `ANTHROPIC_API_KEY` still works as a direct
  alternative when no OpenRouter key is set.
  This replaces the previous "use the latest Claude model" rule. The agent leans
  hard on tool calling — `send_message`, `draft_message`, `move_stage`,
  `update_lead_fields` — so a model with weaker tool adherence shows up as wrong
  actions on real leads, not merely worse prose. Test a model change on
  **Test emails** (`/dashboard/agent`, one lead per run) before trusting it.

## Documentation index (the map)

| Doc | What's in it |
|---|---|
| [design_constraints.md](design_constraints.md) | Design system: fonts, colors, WCAG, motion, layout |
| [README.md](README.md) | Human overview + getting started |
| [ROADMAP.md](ROADMAP.md) | Phased build plan + status |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design & data flow |
| [docs/information-architecture.md](docs/information-architecture.md) | Product IA, navigation, and the core screens |
| [docs/channels.md](docs/channels.md) | Per-channel features + official limits |
| [docs/rate-limits.md](docs/rate-limits.md) | Consolidated quotas + throttling strategy |
| [docs/pricing.md](docs/pricing.md) | Recurring costs (infra + AI/comms COGS) + pricing tier margin analysis |
| [docs/security.md](docs/security.md) | OAuth2, secrets, encryption, RBAC, GDPR |
| [docs/domains-and-mailboxes.md](docs/domains-and-mailboxes.md) | Sending domains via the reseller storefront, DNS verification, mailbox connect |
| [docs/crm-data-model.md](docs/crm-data-model.md) | Lead schema, logs, CSV import/export |
| [docs/templates-and-variables.md](docs/templates-and-variables.md) | Template engine, variables, sequencing |
| [docs/ai-agent.md](docs/ai-agent.md) | Claude agent: tools, prompt, safety |
| [docs/ui-components.md](docs/ui-components.md) | The four supplied frontend assets |

## How to keep this file (and the docs) updated

1. Every doc carries `Last updated:` and `Status: (draft | stable | needs-review)`.
2. **This doc index is the single map** — when you add a doc, link it here.
3. **After any build phase, update the matching doc in the same change.** Code and
   docs move together; a PR that changes channel logic must touch `docs/channels.md`.
4. When a guardrail number changes (a platform raises a limit), update
   `docs/rate-limits.md` first, then the guardrail bullets above.
