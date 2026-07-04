/**
 * BullMQ worker — pulls send jobs at a rate-limited pace and executes them.
 * Run separately from the Next.js server:  npm run worker
 */
import { env, configured } from "./env";
import { SEND_QUEUE, type SendJob } from "./queue";
import { jitterMs } from "./ratelimit";
import { processSendJob } from "./job-processor";

async function main() {
  if (!configured.redis) {
    console.error("[worker] REDIS_URL not set — cannot start worker. See .env.example");
    process.exit(1);
  }
  if (!configured.db) {
    console.error("[worker] DATABASE_URL not set — cannot start worker.");
    process.exit(1);
  }

  const { Worker } = await import("bullmq");
  const IORedis = (await import("ioredis")).default;
  const connection = new IORedis(env.redisUrl!, {
    maxRetriesPerRequest: null,
  }) as unknown as import("bullmq").ConnectionOptions;

  const worker = new Worker<SendJob>(
    SEND_QUEUE,
    async (job) => {
      return processSendJob(job.data);
    },
    {
      connection,
      // Serialize sends + add humanizing jitter between jobs.
      concurrency: 1,
      limiter: { max: 1, duration: 1000 },
    }
  );

  worker.on("completed", async (job) => {
    // brief human-like pause before the next job is processed
    await new Promise((r) => setTimeout(r, jitterMs(5_000, 20_000)));
    console.log(`[worker] job ${job.id} done`);
  });
  worker.on("failed", (job, err) => {
    console.warn(`[worker] job ${job?.id} failed: ${err.message}`);
  });

  console.log("[worker] LeadsKonnect send worker started.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
