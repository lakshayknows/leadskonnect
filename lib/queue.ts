/**
 * BullMQ job queue for throttled, scheduled sends (see docs/ARCHITECTURE.md).
 * Guarded: if REDIS_URL is absent, the queue is null and callers should fall back
 * to inline sending (dev only).
 */
import { env, configured } from "./env";
import type { Channel } from "./channels/types";

export interface SendJob {
  channel: Channel["name"];
  leadId: string;
  campaignId?: string;
  templateId?: string;
  account?: string;
}

export const SEND_QUEUE = "leadskonnect:sends";

let queue: import("bullmq").Queue<SendJob> | null = null;

export async function getQueue(): Promise<import("bullmq").Queue<SendJob> | null> {
  if (!configured.redis) return null;
  if (queue) return queue;
  const { Queue } = await import("bullmq");
  const IORedis = (await import("ioredis")).default;
  const connection = new IORedis(env.redisUrl!, { maxRetriesPerRequest: null });
  queue = new Queue<SendJob>(SEND_QUEUE, {
    connection: connection as unknown as import("bullmq").ConnectionOptions,
  });
  return queue;
}

/** Enqueue a send with an optional delay (ms) for sequencing + jitter. */
export async function enqueueSend(job: SendJob, delayMs = 0): Promise<boolean> {
  // Use QStash on production if configured
  if (configured.qstash && !env.appUrl.includes("localhost")) {
    const delaySeconds = Math.max(0, Math.ceil(delayMs / 1000));
    const destinationUrl = `${env.appUrl}/api/qstash/process`;
    try {
      const response = await fetch(`${env.qstash.url}/v2/publish/${destinationUrl}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.qstash.token}`,
          "Content-Type": "application/json",
          "Upstash-Delay": `${delaySeconds}s`,
        },
        body: JSON.stringify(job),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`[QStash] Failed to publish job: ${err}`);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[QStash] Connection error publishing job:", e);
      return false;
    }
  }

  // Fallback to BullMQ if Redis is configured
  const q = await getQueue();
  if (!q) {
    // If running locally without Redis or QStash, do inline asynchronous sending for convenience
    if (process.env.NODE_ENV === "development") {
      console.warn(`[queue] Redis/QStash not configured. Processing job inline (delayed by ${delayMs}ms)`);
      import("./job-processor").then(({ processSendJob }) => {
        setTimeout(() => {
          processSendJob(job).catch((err) => {
            console.error("[queue] Inline job process failed:", err);
          });
        }, delayMs);
      });
      return true;
    }
    return false;
  }

  await q.add("send", job, {
    delay: delayMs,
    attempts: 5,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
  return true;
}
