# ARCHITECTURE.md — System Design

**Last updated:** 2026-07-03
**Status:** draft

---

## Shape

A single **Next.js (App Router) full-stack** application on Vercel (Fluid Compute,
Node 24 LTS). One codebase, not microservices — channel work is isolated by module,
and long-running / rate-limited work is pushed to a **job queue** rather than separate
services.

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App (Vercel)                      │
│                                                               │
│  app/ (UI)            app/api/ (endpoints + webhooks)         │
│   ├─ dashboard         ├─ /api/leads      (CRM CRUD, CSV)     │
│   ├─ campaigns         ├─ /api/campaigns  (sequences)         │
│   ├─ templates         ├─ /api/webhooks/* (bounces, WA status)│
│   └─ settings          └─ /api/agent      (Claude run)        │
│                                                               │
│  lib/  channels/{email,linkedin,whatsapp,social}             │
│        crm/  templates/  ratelimit/  agent/                  │
└───────────────┬───────────────────────────┬─────────────────┘
                │                             │
        ┌───────▼────────┐            ┌───────▼────────┐
        │  PostgreSQL    │            │  BullMQ queue  │
        │ leads, msgs,   │            │ (Redis)        │
        │ campaigns,logs │            │ throttled jobs │
        └────────────────┘            └───────┬────────┘
                                              │ workers pull at rate-limited pace
                    ┌─────────────────────────┼───────────────────────┐
                    ▼            ▼             ▼            ▼           ▼
                 Gmail/SMTP   Twilio/WA   LinkedIn(API/    Social     CRM sync
                 (Nodemailer) (Meta)       Puppeteer)      APIs       (HubSpot)
```

## Core flows

**1. Lead ingestion.** CSV upload → `/api/leads` → validate + dedupe (by email) →
upsert into `leads`. Custom columns become template variables. See
[crm-data-model.md](crm-data-model.md).

**2. Campaign execution.** A campaign is an ordered **sequence** (email → wait →
LinkedIn → wait → WhatsApp). The scheduler enqueues each step per lead into **BullMQ**
with a delay + jitter. Workers respect per-channel token buckets
([rate-limits.md](rate-limits.md)) and only fire when quota is available; otherwise the
job is re-queued for the next window.

**3. Sending.** Each channel module exposes a uniform interface
(`send(lead, rendered)`), renders the template ([templates-and-variables.md](
templates-and-variables.md)), performs the send, and writes an entry to `messages` +
`activity_log`.

**4. Inbound / status.** Webhooks (`/api/webhooks/*`) capture bounces, WhatsApp
delivery/quality signals, and replies. A reply or "unsubscribe" adds the lead to the
**suppression list** and halts their remaining sequence steps.

**5. Agent orchestration.** The Claude agent ([ai-agent.md](ai-agent.md)) can drive
campaigns via tools that wrap the same channel modules and CRM — it never bypasses the
rate-limit layer.

## Service boundaries (module contracts)

| Module | Responsibility | Talks to |
|---|---|---|
| `lib/crm` | Lead + campaign + log persistence | Postgres / HubSpot API |
| `lib/channels/*` | One send interface per channel | Provider SDKs, `ratelimit` |
| `lib/templates` | Render `{{vars}}` + fallbacks | CRM (lead data) |
| `lib/ratelimit` | Token buckets, jitter, ramp, warm-up | Redis |
| `lib/agent` | Claude tool loop + safety stops | channel modules, CRM |

## Non-functional
- **Idempotency:** every enqueued send carries a unique key; workers no-op on
  duplicates (protects against retries double-sending).
- **Graceful degradation:** on provider throttle/error, back off + re-queue, never
  hammer.
- **Observability:** structured audit log for every action; alerts on bounce/spam
  spikes and unusual send rates ([security.md](security.md)).

## Open decisions
- HubSpot as system-of-record vs. Postgres-primary with optional HubSpot sync.
- Redis provider on Vercel (Marketplace) for BullMQ.
- Whether LinkedIn browser automation runs in a Vercel Sandbox or a dedicated worker
  host (long-lived session + residential IP considerations).
