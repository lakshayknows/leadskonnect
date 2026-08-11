# security.md — Auth, Secrets, Encryption, Compliance

**Last updated:** 2026-07-03
**Status:** draft

> No secrets in source, logs, or client code. Least privilege everywhere. Consent and
> opt-out are non-negotiable.

---

## Authentication

**User login (our app).** Auth0 / Clerk — gives user management, MFA, sessions out of
the box. Sessions via HTTPS-only cookies or JWTs. All endpoints behind auth checks.

**Per-service auth (outbound).**
- **Gmail/Google:** OAuth2 with refresh tokens (rotate regularly); or SMTP with app
  passwords. Request minimal scopes.
- **LinkedIn:** OAuth2; store per-user tokens; note scope restrictions
  ([channels.md](channels.md)).
- **Twilio/WhatsApp:** use scoped **API keys** (not the master account key); store
  encrypted.
- Prefer **short-lived tokens**; limit each token's scope to what its service needs.

## Access control (RBAC)
- Roles: `admin` (create/run campaigns, view raw PII), `member` (limited), `viewer`.
- Only authorized admins can trigger campaigns or export raw contact data.
- Enforce on every server action / API route.

## Secrets management (OWASP-aligned)
- Store all credentials in **env vars / a vault** — never in the repo.
- **Least privilege:** not every service gets every key.
- **Automated rotation**; log access to secret operations.
- Centralize + audit — scattered secrets in code/config are the top leak source.
- `.env.example` documents required keys with placeholder values only.

## Data protection
- **Encrypt PII at rest** (emails/phones — encrypted DB columns or app-level).
- **TLS/HTTPS** for all traffic.
- **Never** put PII or API keys in logs or client-side bundles.
- Encrypted, regular database backups.

## Web app hardening
- CSRF protection; framework auto-escaping to prevent XSS; sanitize all inputs.
- Enforce CORS on APIs.
- Rate-limit our own inbound endpoints (protect against abuse and slow third parties).

## Monitoring & alerting
- Structured audit log of every outreach action (sent / delivered / clicked / bounced).
- Alerts on: bounce/spam spikes, unusual send rates, server errors, secret-access
  anomalies. Auto-pause campaigns on threshold breach (see [rate-limits.md](rate-limits.md)).

## Compliance (GDPR & channel consent)
- **Consent** before contacting (explicit opt-in required for WhatsApp).
- **Unsubscribe** in every email; global suppression list honored across channels.
- **Right to deletion** — provide a path to delete a person's data.
- Maintain an **audit trail** of actions for accountability.
