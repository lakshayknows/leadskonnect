import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

/**
 * better-auth — email/password + "Sign in with Google" social login.
 * The Google provider is registered only when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * are set, so the app still boots without them (the button just won't work).
 * Login callback is handled by better-auth at {baseURL}/api/auth/callback/google
 * — distinct from the gmail.send sending-account flow at /api/auth/google/callback.
 */
const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, autoSignIn: true },
  ...(googleConfigured
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        },
      }
    : {}),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
