/**
 * Single dispatch point for queued jobs, shared by every transport:
 * the QStash webhook, the BullMQ worker, and the dev inline runner.
 */
import type { QueueJob } from "./queue";
import { processSendJob } from "./job-processor";
import { advanceEnrollment } from "./campaign-engine";

export async function runJob(job: QueueJob): Promise<unknown> {
  if (job.kind === "advance") return advanceEnrollment(job.enrollmentId);
  return processSendJob(job);
}
