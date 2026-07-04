import type { RenderedMessage } from "../templates";

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

export interface Channel {
  name: "email" | "linkedin" | "whatsapp" | "social";
  /** whether the required credentials are present */
  isConfigured(): boolean;
  /** perform the send. MUST be called only after quota + suppression checks. */
  send(lead: Lead, rendered: RenderedMessage, account?: string): Promise<SendResult>;
}
