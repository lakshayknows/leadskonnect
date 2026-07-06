/**
 * Authorize scheduled/cron trigger requests to the poller + warm-up endpoints.
 *
 * These jobs run on QStash Schedules (works on any Vercel plan). QStash signs every
 * request, so we verify the Upstash signature — no shared secret required. A CRON_SECRET
 * bearer and the Vercel-cron header are also accepted (for manual curls / future use).
 */
import { env } from "./env";

export async function isAuthorizedCron(req: Request, rawBody = ""): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authz = req.headers.get("authorization");
  if (cronSecret && authz === `Bearer ${cronSecret}`) return true;
  if (req.headers.get("x-vercel-cron")) return true;

  const signature = req.headers.get("upstash-signature");
  if (signature && env.qstash.currentSigningKey && env.qstash.nextSigningKey) {
    try {
      const { Receiver } = await import("@upstash/qstash");
      const receiver = new Receiver({
        currentSigningKey: env.qstash.currentSigningKey,
        nextSigningKey: env.qstash.nextSigningKey,
      });
      const url = `${env.appUrl}${new URL(req.url).pathname}`;
      return await receiver.verify({ signature, body: rawBody, url });
    } catch {
      return false;
    }
  }
  return false;
}
