/**
 * Job queue for throttled, scheduled work (see docs/ARCHITECTURE.md).
 *
 * Two job kinds flow through the same queue:
 *  - "send"    — deliver one message (used by ad-hoc sends).
 *  - "advance" — advance a campaign enrollment by one node (the conditional-node engine,
 *                see lib/campaign-engine.ts). The advance job performs the node's send
 *                inline and schedules the next advance.
 *
 * Transport priority: Upstash QStash (prod) → BullMQ/Redis → inline setTimeout (dev only).
 */
import { env, configured } from "./env";
import type { Channel } from "./channels/types";

export interface SendJob {
  kind?: "send";
  organizationId: string;
  channel: Channel["name"];
  leadId: string;
  campaignId?: string;
  templateId?: string;
  account?: string;
}

export interface AdvanceJob {
  kind: "advance";
  enrollmentId: string;
}

export type QueueJob = SendJob | AdvanceJob;

export const SEND_QUEUE = "followthroo-sends";

let queue: import("bullmq").Queue<QueueJob> | null = null;

export async function getQueue(): Promise<import("bullmq").Queue<QueueJob> | null> {
  if (!configured.redis) return null;
  if (queue) return queue;
  const { Queue } = await import("bullmq");
  const IORedis = (await import("ioredis")).default;
  const connection = new IORedis(env.redisUrl!, { maxRetriesPerRequest: null });
  queue = new Queue<QueueJob>(SEND_QUEUE, {
    connection: connection as unknown as import("bullmq").ConnectionOptions,
  });
  return queue;
}

/** Enqueue any job with an optional delay (ms) for sequencing + jitter. */
export async function enqueueJob(job: QueueJob, delayMs = 0): Promise<boolean> {
  // Use QStash in production if configured
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
        console.error(`[QStash] Failed to publish job: ${await response.text()}`);
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
    // Local dev without Redis or QStash: run inline after the delay for convenience.
    if (process.env.NODE_ENV === "development") {
      console.warn(`[queue] Redis/QStash not configured. Running job inline (delay ${delayMs}ms)`);
      import("./job-router").then(({ runJob }) => {
        setTimeout(() => {
          runJob(job).catch((err) => console.error("[queue] Inline job failed:", err));
        }, delayMs);
      });
      return true;
    }
    return false;
  }

  await q.add(job.kind ?? "send", job, {
    delay: delayMs,
    attempts: 5,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
  return true;
}

/** Back-compat helper for one-off sends. */
export async function enqueueSend(job: Omit<SendJob, "kind">, delayMs = 0): Promise<boolean> {
  return enqueueJob({ kind: "send", ...job }, delayMs);
}
