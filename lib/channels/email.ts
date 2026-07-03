import { env, configured } from "../env";
import type { Channel, Lead, SendResult } from "./types";
import type { RenderedMessage } from "../templates";

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

  async send(lead: Lead, rendered: RenderedMessage): Promise<SendResult> {
    if (!configured.email) return { ok: false, skipped: true, reason: "email not configured" };
    if (!lead.email) return { ok: false, skipped: true, reason: "lead has no email" };
    try {
      const t = await getTransporter();
      const info = await t.sendMail({
        from: env.smtp.from,
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
