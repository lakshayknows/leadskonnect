import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireDb } from "@/lib/http";

export const runtime = "nodejs";

const CreateTemplate = z.object({
  channel: z.enum(["email", "linkedin", "whatsapp", "social"]),
  name: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
});

const SEED_TEMPLATES = [
  {
    channel: "email" as const,
    name: "Cold Outreach: PAS Framework",
    subject: "Quick question about {{company}}'s outreach",
    body: "Hi {{firstName}},\n\nMany sales teams struggle to scale their email outreach without dropping deliverability rates, which directly impacts pipeline growth.\n\nWe help companies automate their personalization so every email reads like a custom 1-on-1 note, boosting replies by 35%.\n\nWould you be open to a 10-minute call this Thursday to see if it makes sense for {{company}}?\n\nBest,\n[Your Name]",
    variables: []
  },
  {
    channel: "email" as const,
    name: "Cold Outreach: Direct Value Pitch",
    subject: "Improving reply rates at {{company}}",
    body: "Hi {{firstName}},\n\nI saw your team is growing, and wanted to see how you are currently handling outbound sales. Most teams waste hours writing manual emails when AI can generate hyper-personalized sequences in seconds.\n\nWe build tools that connect directly to your CRM to automate this workflow.\n\nWould you be open to a brief 10-minute demo next week?\n\nThanks,\n[Your Name]",
    variables: []
  },
  {
    channel: "linkedin" as const,
    name: "LinkedIn: Contextual Connection",
    subject: "",
    body: "Hi {{firstName}}, came across your profile and was impressed by your work at {{company}}. Would love to connect and keep up with your updates here!",
    variables: []
  },
  {
    channel: "linkedin" as const,
    name: "LinkedIn: Value Follow-up",
    subject: "",
    body: "Hi {{firstName}}, thanks for connecting! I recently put together a checklist on how teams at {{company}} can optimize their email deliverability. Let me know if you'd like me to send over the PDF link. Talk soon!",
    variables: []
  },
  {
    channel: "whatsapp" as const,
    name: "WhatsApp: Brief Touchpoint",
    subject: "",
    body: "Hello {{firstName}}! This is [Your Name] from LeadsKonnect. I wanted to follow up on the email I sent regarding your outreach workflows at {{company}}. Do you have 2 minutes for a brief chat?",
    variables: []
  }
];

export async function GET() {
  const guard = requireDb();
  if (guard) return guard;
  
  let templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  
  if (templates.length === 0) {
    console.log("[templates] Seeding 5 default templates...");
    await prisma.template.createMany({
      data: SEED_TEMPLATES,
    });
    templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  }
  
  return ok(templates);
}

export async function POST(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;
  const parsed = CreateTemplate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "invalid body");
  const tpl = await prisma.template.create({ data: parsed.data });
  return ok(tpl, { status: 201 });
}
