/**
 * Resolve the human sender name used to fill {{senderName}} / [Your Name] in outgoing copy.
 * Per-user (from their profile), attributed to the campaign's creator, with the org owner
 * as a fallback so a message is never signed by a bare placeholder.
 */
import { prisma } from "./db";

export async function senderNameForUser(userId?: string | null): Promise<string> {
  if (!userId) return "";
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name?.trim() || "";
}

/**
 * Persona continuity (product PRD §12): a SendingAccount's `name` is the identity a
 * recipient actually sees — it fills email's "From" display name (lib/channels/email.ts).
 * When a send is attributed to a specific account, its name should win over the campaign
 * creator's for the body signature too, so an email's From header and its "Best, ___"
 * sign-off never name two different people — and so a LinkedIn note sent under the same
 * account (job-processor and the agent render both channels through this same lookup)
 * signs consistently with the email side of that persona.
 */
export async function senderNameForAccount(accountId?: string | null): Promise<string> {
  if (!accountId || accountId === "default") return "";
  const a = await prisma.sendingAccount.findUnique({ where: { id: accountId }, select: { name: true } });
  return a?.name?.trim() || "";
}

export async function senderNameForCampaign(campaignId?: string | null, orgId?: string | null): Promise<string> {
  if (campaignId) {
    const c = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { createdBy: true } });
    const byCreator = await senderNameForUser(c?.createdBy);
    if (byCreator) return byCreator;
  }
  if (orgId) {
    const owner = await prisma.member.findFirst({
      where: { organizationId: orgId, role: "owner" },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });
    return senderNameForUser(owner?.userId);
  }
  return "";
}
