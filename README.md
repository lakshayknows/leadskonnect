# LeadsKonnect

An AI-powered multi-channel outreach platform that automates personalized campaigns
across **Email, LinkedIn, WhatsApp, and social comments**, backed by a CRM, a template
engine, a rate-limiting/safety layer, and a Claude agent that orchestrates the whole
sequence — fronted by a premium Next.js UI.

**Last updated:** 2026-07-03
**Status:** foundation built — most channels wired, need credentials to go live

---

## Why

Personalized outreach gets replies; generic blasts get ignored — and get accounts
banned. LeadsKonnect scales personalization while respecting every channel's hard
limits, so it can run at volume *without* tripping spam detection or platform throttles.

## Tech stack

Next.js (App Router, full-stack) · TypeScript · Tailwind CSS v4 · motion/Framer Motion ·
Nodemailer (+DKIM) · Twilio (WhatsApp) · PostgreSQL + Prisma · Redis + BullMQ ·
`@anthropic-ai/sdk` (`claude-opus-4-8`) · Vercel.

## Run it locally

**Prerequisites:** Node 20+ (Node 24 LTS recommended) and npm. Postgres + Redis are
optional to *boot* the app, but required for anything that touches the CRM or queue.

```bash
# 1. install dependencies
npm install

# 2. create your env file, then edit it (see the table below / SETUP.md)
cp .env.example .env.local

# 3. (optional but recommended) spin up Postgres + Redis locally with Docker
docker run -d --name lk-postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=leadskonnect -p 5432:5432 postgres:16
docker run -d --name lk-redis -p 6379:6379 redis:7
# then in .env.local:
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leadskonnect
#   REDIS_URL=redis://localhost:6379

# 4. generate the Prisma client + create the tables
npm run db:generate
npm run db:push

# 5. start the app  →  http://localhost:3000
npm run dev

# 6. (separate terminal) start the send worker for queued/sequenced campaigns
npm run worker
```

### Verify it's up

```bash
curl http://localhost:3000/api/status        # shows which integrations are configured
```

Open the pages:

- `/` — landing (3D card carousel, red manifesto hero, branding section)
- `/dashboard` — command center
- any unknown path — the NEXOVA 404

### The app boots without any credentials

Every integration degrades gracefully: if a channel's env vars are missing, it reports
`"not configured"` instead of crashing. Fill in only the channels you want live. If you
skip Postgres/Redis, the UI still runs — only the CRM/queue API routes return `503`.

## Environment variables (short list)

| Var | Needed for |
|---|---|
| `DATABASE_URL` | CRM, campaigns, agent (Postgres) |
| `REDIS_URL` | queue + shared rate limits (falls back to in-memory without it) |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Email sending |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM` | WhatsApp |
| `LINKEDIN_ACCESS_TOKEN` or `LINKEDIN_LI_AT` | LinkedIn |
| `ANTHROPIC_API_KEY` | AI agent (`/api/agent`) |
| `APP_SECRET` | sessions/tokens |

Full list + manual steps (fonts, DKIM DNS, Twilio templates, LinkedIn driver, webhook
signatures) are in **`SETUP.md`**.

## npm scripts

| Script | Does |
|---|---|
| `npm run dev` | start Next.js dev server |
| `npm run build` / `npm start` | production build / serve |
| `npm run worker` | BullMQ send worker (throttled, humanized sends) |
| `npm run db:push` / `db:generate` / `db:studio` | Prisma schema push / client / GUI |
| `npm run typecheck` / `lint` | TS + lint checks |

## Key API routes

| Route | Purpose |
|---|---|
| `GET/POST /api/leads` | list / upsert leads |
| `GET/PATCH/DELETE /api/leads/:id` | read / update / GDPR-delete |
| `POST /api/leads/import` | CSV import (maps columns → variables, dedupes) |
| `GET/POST/PUT /api/campaigns` | list / create / launch a sequence |
| `POST /api/agent` | run the Claude orchestration agent |
| `POST /api/webhooks/email` · `/whatsapp` | bounce / reply / opt-out handling |
| `GET /api/status` | health + integration map |

## Project docs (kept local, not in this repo)

Architecture, design system, per-channel rules, rate limits, security, and the data
model live in `CLAUDE.md`, `design_constraints.md`, `ROADMAP.md`, and `docs/`. They are
intentionally gitignored. See the "keep updating" protocol in `CLAUDE.md` — code and
docs move together.

## Channel limits at a glance

| Channel | Starting limit |
|---|---|
| Email (Gmail) | 500/day free · 2,000/day paid Workspace |
| LinkedIn | ~20 invites/day (ramp slowly) |
| WhatsApp | 250 unique contacts / 24h (tiers up after verification) |

Enforced centrally in `lib/channels/safeSend` (suppression + rate limit before every send).
