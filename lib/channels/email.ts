import { env, configured } from "../env";
import type { Channel, Lead, SendResult } from "./types";
import type { RenderedMessage } from "../templates";

// --- Gmail OAuth sending via the Gmail API (messages.send) ---
// We use the Gmail API (not SMTP) because the connected accounts hold the
// `gmail.send` scope. Gmail's SMTP requires the broader `https://mail.google.com/`
// scope and rejects gmail.send with "535 BadCredentials".

/** Exchange a stored refresh token for a short-lived access token. */
async function gmailAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.google.clientId!,
      client_secret: env.google.clientSecret!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    throw new Error(`Gmail token refresh failed: ${j.error_description || j.error || res.status}`);
  }
  return j.access_token as string;
}

/** RFC 2047-encode a header value only if it contains non-ASCII. */
function encodeHeader(s: string): string {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(s) ? `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=` : s;
}

/** Send one HTML email through the Gmail API; returns the Gmail message id. */
async function sendViaGmailApi(
  refreshToken: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<string> {
  const token = await gmailAccessToken(refreshToken);
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  const raw = Buffer.from(mime, "utf8").toString("base64url");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gmail API send failed: ${j.error?.message || res.status}`);
  return j.id as string;
}

// Lazily-created transporter so importing this file never requires SMTP creds.
let transporter: import("nodemailer").Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;
  const nodemailer = await import("nodemailer");
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user!, pass: env.smtp.pass! },
    ...(env.smtp.dkim.domainName && env.smtp.dkim.privateKey
      ? {
          dkim: {
            domainName: env.smtp.dkim.domainName,
            keySelector: env.smtp.dkim.keySelector,
            privateKey: env.smtp.dkim.privateKey,
          },
        }
      : {}),
  });
  return transporter;
}

export const emailChannel: Channel = {
  name: "email",
  isConfigured: () => configured.email,

  async send(lead: Lead, rendered: RenderedMessage, account = "default"): Promise<SendResult> {
    if (!lead.email) return { ok: false, skipped: true, reason: "lead has no email" };
    try {
      let t: import("nodemailer").Transporter;
      let fromAddress = env.smtp.from;

      if (account && account !== "default") {
        const { prisma } = await import("../db");
        const sendingAccount = await prisma.sendingAccount.findUnique({
          where: { id: account },
        });
        if (!sendingAccount) {
          return { ok: false, skipped: true, reason: `Sending account ${account} not found` };
        }
        if (!sendingAccount.active) {
          return { ok: false, skipped: true, reason: `Sending account ${account} is inactive` };
        }
        fromAddress = sendingAccount.from || `${sendingAccount.name} <${sendingAccount.email}>`;

        // Gmail OAuth accounts send through the Gmail API (matches the gmail.send scope).
        if (sendingAccount.provider === "gmail_oauth") {
          if (!configured.google) {
            return { ok: false, error: "Google OAuth not configured on server" };
          }
          if (!sendingAccount.refreshToken) {
            return { ok: false, skipped: true, reason: `Gmail account ${account} needs re-connect (no refresh token)` };
          }
          const id = await sendViaGmailApi(
            sendingAccount.refreshToken,
            fromAddress,
            lead.email,
            rendered.subject ?? "",
            rendered.body
          );
          return { ok: true, providerId: id };
        }

        // SMTP account.
        if (!sendingAccount.host || !sendingAccount.user || !sendingAccount.pass) {
          return { ok: false, error: `SMTP account ${account} is missing host/user/pass` };
        }
        const nodemailer = await import("nodemailer");
        t = nodemailer.createTransport({
          host: sendingAccount.host,
          port: sendingAccount.port,
          secure: sendingAccount.secure,
          auth: { user: sendingAccount.user, pass: sendingAccount.pass },
        });
      } else {
        if (!configured.email) return { ok: false, skipped: true, reason: "email not configured" };
        t = await getTransporter();
      }

      const info = await t.sendMail({
        from: fromAddress,
        to: lead.email,
        subject: rendered.subject ?? "",
        html: rendered.body,
        text: rendered.body.replace(/<[^>]+>/g, " "),
      });
      return { ok: true, providerId: info.messageId };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
