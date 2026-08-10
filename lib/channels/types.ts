import type { RenderedMessage } from "../templates";
import type { IdentityInput } from "../identity";

export interface Lead {
  id: string;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  firstName?: string | null;
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  /** set when the channel is not configured or the send was skipped */
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * What an adapter can actually do, declared rather than assumed.
 *
 * The sequence engine reads this instead of hardcoding per-channel rules — so
 * WhatsApp's 24-hour session window and DLT-style template gating are facts the
 * adapter states about itself, not conditionals scattered through the caller.
 */
export interface AdapterCapabilities {
  send: boolean;
  receive: boolean;
  /** Provider requires pre-approved templates (WhatsApp, India SMS DLT). */
  templates: boolean;
  /**
   * Free-form replies are only allowed within this many hours of the contact's
   * last inbound message; outside it, only an approved template may be sent.
   */
  sessionWindowHours?: number;
  /** Explicit opt-in is required before the first outbound message. */
  requiresOptIn: boolean;
  /** Provider or policy ceiling, per account, per day. */
  maxPerDay?: number;
  /** Delivery happens outside our servers (e.g. the LinkedIn browser extension). */
  humanAssisted?: boolean;
}

/**
 * A normalised inbound event. Every adapter — messaging channel or lead
 * aggregator — produces this exact shape, which is what lets one identity graph
 * and one conversation timeline serve all of them.
 */
export interface InboundEvent {
  /** Identifiers to resolve the contact by; at least one is required. */
  identities: IdentityInput[];
  channel: "email" | "linkedin" | "whatsapp" | "social";
  direction: "inbound" | "outbound";
  /** Provider's own id — the dedupe key for webhook retries. */
  externalId?: string;
  subject?: string;
  body?: string;
  occurredAt?: Date;
  profile?: { firstName?: string | null; lastName?: string | null; company?: string | null; title?: string | null };
  /** Machine key for LeadSource — meta_lead_ads, indiamart, web_form, … */
  sourceKey?: string;
  meta?: Record<string, unknown>;
}

/**
 * The adapter contract from the product PRD.
 *
 * Inbound-only sources (lead aggregators, ad platforms) implement `receive` and
 * `capabilities` and simply omit `send`, which is why both are optional here
 * rather than forcing stub throws into every ingestion adapter.
 */
export interface Adapter {
  name: string;
  capabilities(): AdapterCapabilities;
  isConfigured(): boolean;
  send?(lead: Lead, rendered: RenderedMessage, account?: string): Promise<SendResult>;
  /** Parse a provider payload into normalised events. */
  receive?(payload: unknown, headers?: Headers): Promise<InboundEvent[]>;
  /** Verify a webhook signature before anything is parsed or trusted. */
  verify?(rawBody: string, headers: Headers): boolean;
}

/**
 * Retained so the existing send path keeps compiling unchanged. Outbound
 * channels satisfy both this and `Adapter`.
 */
export interface Channel {
  name: "email" | "linkedin" | "whatsapp" | "social";
  isConfigured(): boolean;
  send(lead: Lead, rendered: RenderedMessage, account?: string): Promise<SendResult>;
  capabilities?(): AdapterCapabilities;
  receive?(payload: unknown, headers?: Headers): Promise<InboundEvent[]>;
  verify?(rawBody: string, headers: Headers): boolean;
}
