/**
 * BullMQ worker — pulls send jobs at a rate-limited pace and executes them.
 * Run separately from the Next.js server:  npm run worker
 */
import { env, configured } from "./env";
import { SEND_QUEUE, type SendJob } from "./queue";
import { prisma } from "./db";
import { safeSend } from "./channels";
import { renderMessage } from "./templates";
import { logActivity } from "./crm";
import { jitterMs } from "./ratelimit";
import { randomUUID } from "node:crypto";

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
      const { channel, leadId, campaignId, templateId, account } = job.data;
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new Error(`lead ${leadId} not found`);

      const tpl = templateId
        ? await prisma.template.findUnique({ where: { id: templateId } })
        : null;
      const rendered = tpl
        ? renderMessage(tpl, lead)
        : { body: "", subject: undefined };

      const result = await safeSend(
        channel,
        {
          id: lead.id,
          email: lead.email,
          phone: lead.phone,
          linkedinUrl: lead.linkedinUrl,
          firstName: lead.firstName,
        },
        rendered,
        account
      );

      await prisma.message.create({
        data: {
          leadId: lead.id,
          campaignId,
          channel,
          templateId,
          renderedSubject: rendered.subject,
          renderedBody: rendered.body,
          status: result.ok ? "sent" : result.skipped ? "queued" : "failed",
          providerId: result.providerId,
          idempotencyKey: randomUUID(),
          sentAt: result.ok ? new Date() : null,
        },
      });

      await logActivity({
        leadId: lead.id,
        campaignId,
        type: result.ok ? "sent" : "failed",
        channel,
        meta: { reason: result.reason, error: result.error },
      });

      // If rate-limited, re-throw so BullMQ retries with backoff.
      if (!result.ok && result.reason?.startsWith("rate-limited")) {
        throw new Error(result.reason);
      }

      return result;
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
