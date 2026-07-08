/**
 * Authorize scheduled/cron trigger requests to the poller + warm-up endpoints.
 *
 * These jobs run on QStash Schedules. QStash signs every request, so we verify the Upstash
 * signature — no shared secret required. A CRON_SECRET bearer is also accepted (manual runs).
 *
 * NOTE: we deliberately do NOT trust `x-vercel-cron` — external clients can spoof it, and
 * these endpoints fan out across every org, so a header check would be a tenant-data leak.
 */
import { env } from "./env";

export async function isAuthorizedCron(req: Request, rawBody = ""): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authz = req.headers.get("authorization");
  if (cronSecret && authz === `Bearer ${cronSecret}`) return true;

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
