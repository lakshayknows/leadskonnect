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
