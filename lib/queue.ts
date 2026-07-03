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
  queue = new Queue<SendJob>(SEND_QUEUE, { connection });
  return queue;
}

/** Enqueue a send with an optional delay (ms) for sequencing + jitter. */
export async function enqueueSend(job: SendJob, delayMs = 0): Promise<boolean> {
  const q = await getQueue();
  if (!q) return false;
  await q.add("send", job, {
    delay: delayMs,
    attempts: 5,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
  return true;
}
