/**
 * Outreach orchestration agent — mirrors docs/ai-agent.md.
 * Uses NVIDIA's OpenAI-compatible endpoint (integrate.api.nvidia.com/v1) with a
 * tool-capable model. Tools wrap the SAME rate-limited send path, so the agent can
 * never exceed platform limits.
 */
import type OpenAI from "openai";
import { env, configured } from "./env";
import { prisma } from "./db";
import { safeSend } from "./channels";
import { renderMessage } from "./templates";
import { logActivity } from "./crm";
import type { Channel } from "./channels/types";
import { randomUUID } from "node:crypto";

const SYSTEM_PROMPT = `You orchestrate a multi-channel outreach campaign for LeadsKonnect.

Rules (never violate):
- Only act on leads provided to you. Never invent recipients, emails, phones, or consent.
- Respect suppression: if a send comes back "suppressed" or "rate-limited", skip and move on.
- Hard limits: 40 emails/hour, 20 LinkedIn invites/day, 250 WhatsApp/day (enforced by the tool).
- Prefer email first; only use WhatsApp when a phone + opt-in exists.
- Keep copy personalized and human. Call send_message once per lead, then give a short summary.`;

// OpenAI-format tool definition (NVIDIA models use the same schema).
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "send_message",
      description:
        "Send one outreach message to a lead on a channel. Enforces suppression + rate limits internally.",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          channel: { type: "string", enum: ["email", "linkedin", "whatsapp", "social"] },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["leadId", "channel", "body"],
      },
    },
  },
];

async function runSendTool(input: {
  leadId: string;
  channel: Channel["name"];
  subject?: string;
  body: string;
}, accountId?: string) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) return { ok: false, reason: "lead not found" };
  const rendered = renderMessage({ subject: input.subject, body: input.body }, lead);
  const result = await safeSend(
    input.channel,
    {
      id: lead.id,
      email: lead.email,
      phone: lead.phone,
      linkedinUrl: lead.linkedinUrl,
      firstName: lead.firstName,
    },
    rendered,
    accountId
  );

  await prisma.message.create({
    data: {
      leadId: lead.id,
      channel: input.channel,
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
    type: result.ok ? "sent" : "failed",
    channel: input.channel,
    meta: { reason: result.reason },
  });
  return result;
}

export interface AgentRunResult {
  ok: boolean;
  summary: string;
  steps: number;
}

/** Run the agent over a set of leads with a campaign brief. */
export async function runAgent(opts: {
  leadIds: string[];
  brief: string;
  maxSteps?: number;
  sendingAccountId?: string;
}): Promise<AgentRunResult> {
  if (!configured.agent) {
    return { ok: false, summary: "NVIDIA_API_KEY not set", steps: 0 };
  }

  const OpenAISDK = (await import("openai")).default;
  // Fail fast: NVIDIA completions occasionally hang. Without an explicit timeout the
  // SDK waits 10 min × retries, blowing past Vercel's function limit and surfacing an
  // opaque 500. 60s + one retry turns a hang into a clear, catchable error.
  const client = new OpenAISDK({
    apiKey: env.nvidia.apiKey!,
    baseURL: env.nvidia.baseUrl,
    timeout: 60_000,
    maxRetries: 1,
  });

  const leads = await prisma.lead.findMany({ where: { id: { in: opts.leadIds } } });
  const leadTable = leads
    .map((l) => `- ${l.id}: ${l.firstName ?? ""} ${l.lastName ?? ""} <${l.email ?? "no-email"}> @ ${l.company ?? ""}`)
    .join("\n");

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Campaign brief:\n${opts.brief}\n\nLeads:\n${leadTable}\n\nSend appropriate personalized messages now.`,
    },
  ];

  const maxSteps = opts.maxSteps ?? 20;
  let steps = 0;

  for (; steps < maxSteps; steps++) {
    const resp = await client.chat.completions.create({
      model: env.nvidia.model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 1024,
    });

    const msg = resp.choices[0]?.message;
    if (!msg) return { ok: true, summary: "no response", steps };
    messages.push(msg);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) {
      return { ok: true, summary: msg.content ?? "done", steps };
    }

    for (const call of calls) {
      if (call.type !== "function") continue;
      let args: Parameters<typeof runSendTool>[0];
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        messages.push({ role: "tool", tool_call_id: call.id, content: `{"ok":false,"reason":"bad arguments"}` });
        continue;
      }
      const out = await runSendTool(args, opts.sendingAccountId);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out) });
    }
  }

  return { ok: true, summary: "max steps reached", steps };
}
