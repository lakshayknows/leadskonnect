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
        const nodemailer = await import("nodemailer");

        if (sendingAccount.provider === "gmail_oauth") {
          if (!configured.google) {
            return { ok: false, error: "Google OAuth not configured on server" };
          }
          if (!sendingAccount.refreshToken) {
            return { ok: false, skipped: true, reason: `Gmail account ${account} needs re-connect (no refresh token)` };
          }
          // nodemailer auto-refreshes the access token from the stored refresh token.
          t = nodemailer.createTransport({
            service: "gmail",
            auth: {
              type: "OAuth2",
              user: sendingAccount.email,
              clientId: env.google.clientId,
              clientSecret: env.google.clientSecret,
              refreshToken: sendingAccount.refreshToken,
            },
          });
        } else {
          if (!sendingAccount.host || !sendingAccount.user || !sendingAccount.pass) {
            return { ok: false, error: `SMTP account ${account} is missing host/user/pass` };
          }
          t = nodemailer.createTransport({
            host: sendingAccount.host,
            port: sendingAccount.port,
            secure: sendingAccount.secure,
            auth: { user: sendingAccount.user, pass: sendingAccount.pass },
          });
        }
        fromAddress = sendingAccount.from || `${sendingAccount.name} <${sendingAccount.email}>`;
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
