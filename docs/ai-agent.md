# ai-agent.md — The Claude Orchestration Agent

**Last updated:** 2026-08-11
**Status:** stable (this now matches `lib/agent.ts`, not just the aspiration)

> A Claude agent drives campaigns and pipeline qualification by calling tools that wrap
> the same channel modules and CRM every manual action uses. It **never** bypasses
> `lib/ratelimit` or the suppression list.

---

## Model

- `ANTHROPIC_MODEL` (default `claude-opus-5`) runs the main tool-calling loop.
- `ANTHROPIC_CLASSIFIER_MODEL` (default `claude-haiku-4-5-20251001`) runs reply-intent
  classification separately — that call fires on every inbound reply, not just inside a
  campaign run, so it deliberately uses a smaller/cheaper model.
- Uses the `@anthropic-ai/sdk` Messages API directly (not the Agent SDK) — the tool loop
  is simple enough not to need it, and this keeps the request/response shape explicit.

## Tools (`lib/agent.ts`, each wraps an existing module)

| Tool | Wraps | What it does |
|---|---|---|
| `send_message` | `lib/channels` (`safeSend`) | Dispatches now — suppression + rate limits enforced internally, same path every manual send uses. |
| `draft_message` | `Message` (status `draft`) | Writes the message without sending it. The model reaches for this instead of `send_message` when it isn't confident enough to send unattended (confidence-gated autonomy, product PRD §7). A human approves or discards from the Drafts panel on `/dashboard/agent` (`app/api/agent/drafts`). |
| `move_stage` | `lib/pipeline` (`moveToStage`) | Advances (or, with a reason, moves back) a contact's pipeline stage with `actorKind: "ai"` — the only thing that makes `getAiMoveShare()`'s "% of moves driven by AI" metric (rendered on the Ageing page) ever read above 0%. |
| `update_lead_fields` | `Lead` + `lib/scoring` | Writes budget/timeline/decision-maker signals straight onto the lead from the conversation, then recomputes its score — the "conversational qualification" capability the product PRD calls the single biggest gap in the category. |

All tools **acquire quota internally** (via `safeSend`) and log to `ActivityLog` where
relevant — the agent cannot send faster than the rate limiter allows, and every tool call
is scoped to the calling org (`organizationId` passed explicitly, never inferred).

## Context the model actually gets

Per lead: identity, current pipeline stage **and the real stage ids it may move to**, known
qualifying signals, and up to 5 recent conversation turns pulled from the unified
`ConversationEvent` timeline (both directions, every channel) — this is what makes
next-best-channel reasoning and qualification possible instead of the model guessing.

## Confidence-gated autonomy

`POST /api/agent` accepts `confidenceThreshold` (0–1, default 0.7), surfaced in the UI as
three presets (Conservative / Balanced / Autonomous). It's embedded directly into the
system prompt as an instruction, not compared against a self-reported numeric score from
the model — LLMs calibrate probabilities poorly, so the choice between `send_message` and
`draft_message` is a qualitative call the model makes per-message, not arithmetic.

## Reply-intent classification

`classifyReplyIntent()` runs on every inbound reply to an existing contact
(`lib/inbox/store.ts`'s `recordInbound` — the reply-poller's path). It's deliberately not
wired into `lib/ingest.ts`'s inbound-webhook path: those events are first-touch lead
captures (a Meta Ads or web-form submission), not replies to prior outreach, so
"objection"/"interested" framing doesn't apply the same way. Tags one of:
`interested | objection | ooo | wrong_person | unsubscribe | other`. Stored in
`ConversationEvent.meta.intent` (no schema change — reusing the existing JSON field).
Auto-routing off that tag (e.g., auto-escalating an objection) is a natural follow-up, not
built yet.

## Safety stops the agent must honor

- Suppression / opt-out → `safeSend` returns `skipped`, the agent moves on, never retries.
- Rate-limited → same: `safeSend` reports it, the agent doesn't fight the limiter.
- Never invent recipients, phone numbers, or consent. Only acts on leads explicitly passed
  into the run.

## Where it runs

Triggered from `/api/agent` (`maxDuration = 300`, Vercel Fluid Compute). Tool calls go
through the same authenticated, rate-limited paths as manual sends — there is no separate
"agent-only" code path for actually contacting someone.
