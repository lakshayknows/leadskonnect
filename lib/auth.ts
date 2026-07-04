import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

/**
 * better-auth — email/password login (Stage 1).
 * Google OAuth (social login + gmail.send sending accounts) is added in Stage 2 once
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are provided.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, autoSignIn: true },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
