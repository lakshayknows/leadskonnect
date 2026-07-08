/**
 * LinkedIn extension auth. Each member gets a `LinkedInAccount` holding an `extToken`
 * (a bearer the Chrome extension sends). One account per (org, user).
 */
import { prisma } from "../db";
import { fail } from "../http";
import { randomBytes } from "node:crypto";

export function genToken() {
  return randomBytes(24).toString("base64url");
}

export async function getOrCreateAccount(organizationId: string, userId: string) {
  const existing = await prisma.linkedInAccount.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (existing) return existing;
  return prisma.linkedInAccount.create({
    data: { organizationId, userId, extToken: genToken() },
  });
}

/** Resolve an extension request (Bearer <extToken>) to its LinkedInAccount, or a 401. */
export async function requireExtAuth(req: Request) {
  const authz = req.headers.get("authorization") ?? "";
  const token = (authz.startsWith("Bearer ") ? authz.slice(7) : req.headers.get("x-ext-token") ?? "").trim();
  if (!token) return fail("missing extension token", 401);
  const account = await prisma.linkedInAccount.findUnique({ where: { extToken: token } });
  if (!account) return fail("invalid extension token", 401);
  return account;
}
