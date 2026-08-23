# domains-and-mailboxes.md — Sending domains via the reseller storefront

**Last updated:** 2026-08-23
**Status:** draft

> Customers buy a lookalike domain and business mailboxes through our
> white-labelled GoDaddy reseller storefront, then Followthroo verifies the mail
> records and connects the mailbox. The point is deliverability: cold outreach
> should never run on the domain a company's invoices go out on.

---

## Why this shape

The reseller plan is a **Turnkey (Basic/Pro) storefront** on Wild West Domains —
`secureserver.net`, private-label id `601578`, branded "brandstac". On that plan:

- **The store takes the payment.** GoDaddy charges the customer and credits us
  the margin between wholesale and our retail price. So the product must **not**
  run its own checkout for domains — that would charge twice. There is
  deliberately no order table, no payment gateway, and no Razorpay integration.
- **The domain lands in the customer's own registrar account,** not ours. We can
  read its DNS from a public resolver but can never write it. Every domain here
  is therefore `dnsMode: "manual"`.
- **No API credentials are involved.** `configured.storefront` is true by
  default, so the feature works on a fresh checkout with an empty `.env.local`.

### What we deliberately don't do

| Not done | Why |
|---|---|
| Check availability in-app | Needs the registrar's Availability API, gated behind holding 50+ domains, and the store checks it live on the page we send people to. Guessing would only add a way to be wrong. |
| Show a price in-app | The store is the source of truth. A number quoted here would be wrong the moment storefront pricing changes. |
| Register the domain via API | The store does it, and that is what pays commission. |
| Write DNS records | The domain is in the customer's account. We record what we expect and watch public DNS for it. |

### If an API Reseller plan is approved later

That is a different channel — wholesale rates, our own checkout, our own
margin collected directly — and a different protocol (Wild West Domains SOAP at
`api.wildwestdomains.com`, with OTE certification required). It would replace
steps one and two only. Everything below the purchase — record templates,
verification, the sweep, mailbox connect, warm-up — is unchanged by it.

Note that **`developer.godaddy.com` keys are not that channel.** Those are
retail keys on your own account: no wholesale, no commission. Production access
also gates the Availability API behind 50+ domains (Management/DNS needs 1+).

---

## The flow

Three steps, at `/dashboard/accounts/new`. Position lives in the URL
(`?step=&domain=`), so a refresh — or coming back a day later while DNS was
still propagating — resumes where it left off.

1. **Pick a domain.** Suggestions are generated locally from the domain the
   workspace already sends from (`lib/domains/suggest.ts`), ranked `.com` first,
   prefixes over suffixes, no hyphens or digits. Each links into the storefront
   with the `plid` attached. The customer buys there.
2. **Point the mail records.** `POST /api/domains` starts tracking the domain and
   writes the expected record set. Verification then reads **public DNS over
   DoH** and reports each record.
3. **Connect the mailbox.** Never a server form by default. The detected
   provider decides how:
   - **Google Workspace** → one click through the existing OAuth flow. The
     domain id rides along in a cookie so the callback links the mailbox and
     returns to this step instead of the Accounts list.
   - **Titan / Microsoft / classic** → address and password only; the servers
     are already known and shown read-only.
   - **Unrecognised** → the full server form.

   Manual entry and "use a Google account instead" stay available as quiet
   escape hatches from either path. The mailbox becomes an ordinary
   `SendingAccount` and warm-up starts on a 21-day ramp.

Buying **Professional Email on the same domain** is the happy path: the records
are provisioned inside one account, so step two turns green on its own.

---

## Provider detection

The store sells **Professional Email, which is Titan** (`titan.email`) — not
Microsoft, not Google. But a customer may already run Google Workspace or
Microsoft 365 on a domain they bring, so the naive design — one hardcoded record
set, "your DNS must say this" — would tell them their working mail is broken.

So it works the other way round. `lib/domains/providers.ts` resolves the MX
records the domain actually has, matches them to a known provider, and checks
SPF against **that** provider's include.

| Provider | MX | SPF include | SMTP | Connect |
|---|---|---|---|---|
| Titan (Professional Email) | `mx1.titan.email` (10), `mx2.titan.email` (20) | `spf.titan.email` | `smtp.titan.email:587` STARTTLS | password |
| Google Workspace | `*.google.com` | `_spf.google.com` | — | **OAuth** |
| Microsoft 365 | `*.mail.protection.outlook.com` | `spf.protection.outlook.com` | `smtp.office365.com:587` | password |
| Professional Email (classic) | `*.secureserver.net` | `secureserver.net` | `smtpout.secureserver.net:587` | password |

Detection is what makes step three work: knowing the provider means knowing the
SMTP host, so the customer never has to look one up.

Note Titan **blocks third-party apps when 2FA is on** — if a connect fails with
an auth error and the credentials are right, that is the first thing to check.

## Verification

`lib/domains/dns.ts` resolves over DNS-over-HTTPS (Cloudflare, falling back to
Google) rather than asking the registrar. Those are different questions — the
registrar knows its own zone immediately, but a receiving mail server only sees
what has propagated. Reporting "verified" before that is true would hand someone
a green light to send on a domain that cannot yet deliver.

Matching is deliberately tolerant, because a customer's own valid setup must not
read as broken:

| Record | Passes when |
|---|---|
| MX | the records resolve to **any recognised provider** — one row, not one per host, since every host would report the same status |
| SPF | the detected provider's `include:` is present — a customer may have merged it into an existing record |
| DMARC | any valid `v=DMARC1` policy exists; a stricter one than ours is better, not worse |
| DKIM | the CNAME target matches (added only once a selector is issued) |

A resolver failure returns `null`, not "missing" — an outage at Cloudflare must
never be reported to a customer as a mistake they made.

Backoff runs 20s → 1m → 2m → 5m → 15m → 1h, then hourly for ~48h, then stops
with `failureReason` set. A domain that fails verification is **never** marked
`failed` — it is real and paid for; only the records are late.

## Data model

| Model | Holds |
|---|---|
| `Domain` | one sending domain per workspace. `nextCheckAt` is the source of truth for what is due; the queue is only transport. `status` is `dns_pending → active`, or `failed`/`expired`. |
| `DomainDnsRecord` | one expected record plus what the resolver last returned. `observedValue` is shown beside the expectation on a mismatch, so a typo is visible rather than merely reported. |

`SendingAccount` gained `domainId` and a `"managed"` provider value. That is the
load-bearing choice: a purchased mailbox is an **ordinary sending account**, so
`safeSend`, warm-up, the reply poller and deliverability scoring all work on it
without a line of new code.

---

## Jobs and recovery

- `{ kind: "domain-verify-dns", domainId }` — re-check and reschedule. Safe to
  retry: it only reads DNS and records what it saw.
- `/api/cron/domain-sweep` — every 5 minutes via QStash Schedules
  (`scripts/setup-qstash-schedules.ts`). Picks up every domain whose
  `nextCheckAt` is due, so a dropped queue message delays a check rather than
  stranding a domain.

Inspect with `npx tsx scripts/verify-domains.ts` — it re-resolves live and tells
you when the stored state is behind what DNS actually says. `--stuck` shows only
what needs attention; `--config` prints the storefront wiring.

---

## Configuration

```
RESELLER_PLID=601578                              # attributes the sale — wrong id, no commission
RESELLER_STOREFRONT_URL=https://www.secureserver.net
```

Both have working defaults. Neither is a secret; the `plid` travels in a public
URL, which is why the feature needs no credentials to run.

---

## Known gaps

1. **Titan DKIM selectors are not wired up.** MX, SPF and DMARC are verified;
   DKIM is only checked once a selector is known, and nothing supplies one yet.
   Until then a domain can reach "verified" without DKIM, which is weaker than
   it sounds for cold outreach. `dkimRecord()` is the hook.
2. **`SendingAccount.pass` is a plaintext column**, as are `refreshToken` and
   `dkimPrivateKey`. Pre-existing, and tolerable when a few customers paste their
   own app password. It matters more now that this flow actively asks people to
   store mailbox credentials. See `docs/security.md`.
3. **No ownership proof.** Anyone can add any domain name to their workspace.
   That is currently harmless — nothing is bought or sent until a mailbox
   authenticates against it, which is itself the proof — but it would need a
   TXT-token check before anything with a cost hangs off it.
   `lib/ingest-key.ts` is the pattern to copy: derive the token from the app
   secret rather than storing one.
