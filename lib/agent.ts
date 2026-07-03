/**
 * Claude orchestration agent — mirrors docs/ai-agent.md.
 * Uses the latest model (claude-opus-4-8). Tools wrap the SAME rate-limited send path,
 * so the agent can never exceed platform limits.
 */
import type AnthropicNS from "@anthropic-ai/sdk";
import { env, configured } from "./env";
import { prisma } from "./db";
import { safeSend } from "./channels";
import { renderMessage } from "./templates";
import { logActivity } from "./crm";
import type { Channel } from "./channels/types";
import { randomUUID } from "node:crypto";

const SYSTEM_PROMPT = `You orchestrate a multi-channel outreach campaign for LeadsKonnect.

Rules (never violate):
- Only act on leads provided by the tools. Never invent recipients, emails, phones, or consent.
- Respect suppression: if a send is reported "suppressed" or "rate-limited", skip and move on.
- Hard limits: 40 emails/hour, 20 LinkedIn invites/day, 250 WhatsApp/day (enforced by tools).
- Prefer email first; only use WhatsApp when a phone + opt-in exists.
- Keep copy personalized and human. Report a concise summary at the end.`;

// Tool the model can call to send one message through the safe path.
const TOOLS = [
  {
    name: "send_message",
    description:
      "Send one outreach message to a lead on a channel. Enforces suppression + rate limits internally.",
    input_schema: {
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
] as const;

async function runSendTool(input: {
  leadId: string;
  channel: Channel["name"];
  subject?: string;
  body: string;
}) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) return { ok: false, reason: "lead not found" };
  const rendered = renderMessage({ subject: input.subject, body: input.body }, lead);
  const result = await safeSend(input.channel, {
    id: lead.id,
    email: lead.email,
    phone: lead.phone,
    linkedinUrl: lead.linkedinUrl,
    firstName: lead.firstName,
  }, rendered);

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
  await logActivity({ leadId: lead.id, type: result.ok ? "sent" : "failed", channel: input.channel, meta: { reason: result.reason } });
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
}): Promise<AgentRunResult> {
  if (!configured.anthropic) {
    return { ok: false, summary: "ANTHROPIC_API_KEY not set", steps: 0 };
  }

  const AnthropicSDK = (await import("@anthropic-ai/sdk")).default;
  const client = new AnthropicSDK({ apiKey: env.anthropic.apiKey! });

  const leads = await prisma.lead.findMany({ where: { id: { in: opts.leadIds } } });
  const leadTable = leads
    .map((l) => `- ${l.id}: ${l.firstName ?? ""} ${l.lastName ?? ""} <${l.email ?? "no-email"}> @ ${l.company ?? ""}`)
    .join("\n");

  const messages: AnthropicNS.MessageParam[] = [
    {
      role: "user",
      content: `Campaign brief:\n${opts.brief}\n\nLeads:\n${leadTable}\n\nSend appropriate personalized messages now.`,
    },
  ];

  const maxSteps = opts.maxSteps ?? 20;
  let steps = 0;

  for (; steps < maxSteps; steps++) {
    const resp = await client.messages.create({
      model: env.anthropic.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS as unknown as AnthropicNS.Tool[],
      messages,
    });

    messages.push({ role: "assistant", content: resp.content });

    const toolUses = resp.content.filter((c) => c.type === "tool_use");
    if (toolUses.length === 0) {
      const text = resp.content.find((c) => c.type === "text");
      return { ok: true, summary: text?.type === "text" ? text.text : "done", steps };
    }

    const toolResults: AnthropicNS.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (tu.type !== "tool_use") continue;
      const out = await runSendTool(tu.input as Parameters<typeof runSendTool>[0]);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(out),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { ok: true, summary: "max steps reached", steps };
}
