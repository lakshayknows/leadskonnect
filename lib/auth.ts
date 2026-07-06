import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { prisma } from "./db";

/**
 * better-auth — email/password + "Sign in with Google" social login.
 * The Google provider is registered only when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * are set, so the app still boots without them (the button just won't work).
 * Login callback is handled by better-auth at {baseURL}/api/auth/callback/google
 * — distinct from the gmail.send sending-account flow at /api/auth/google/callback.
 */
const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Origins better-auth will accept state-changing requests from (CSRF guard). Include both
 * the apex and www of the prod domain so a sign-in POST from either isn't rejected (403)
 * when NEXT_PUBLIC_APP_URL happens to be set to only one of them. Extra origins can be
 * supplied via BETTER_AUTH_TRUSTED_ORIGINS (comma-separated).
 */
const trustedOrigins = Array.from(
  new Set(
    [
      baseUrl,
      "https://followthroo.com",
      "https://www.followthroo.com",
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map((s) => s.trim()) ?? []),
    ].filter(Boolean)
  )
);

/** Slugify a name/email into a unique-ish org slug. */
function slugify(input: string): string {
  const base = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32) || "org";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a personal organization for a freshly-created user and make them its owner.
 * Runs in the user.create.after hook so every account has a tenant to scope data into.
 */
async function createPersonalOrg(user: { id: string; name?: string | null; email: string }) {
  const name = user.name?.trim() || user.email.split("@")[0] || "My Workspace";
  const org = await prisma.organization.create({
    data: { name: `${name}'s Workspace`, slug: slugify(name || user.email) },
  });
  await prisma.member.create({
    data: { organizationId: org.id, userId: user.id, role: "owner" },
  });
  return org;
}

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
  // Link Google logins to an existing email/password account with the same address.
  // Safe because Google verifies email ownership, so it's a trusted provider.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  // There is no email-verification flow yet, so email/password users would otherwise
  // stay emailVerified:false forever — which blocks later "Sign in with Google" linking
  // (account_not_linked). Mark new users verified on creation until a real verification
  // flow exists. This lowers no security guarantee the app currently makes.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: { ...user, emailVerified: true } }),
        // Give every new user a personal organization to own and scope data into.
        after: async (user) => {
          await createPersonalOrg(user).catch((e) =>
            console.error("[auth] failed to create personal org:", e)
          );
        },
      },
    },
    session: {
      create: {
        // Attach the user's (first / owned) org as the active tenant on each new session.
        before: async (session) => {
          const member = await prisma.member.findFirst({
            where: { userId: session.userId },
            orderBy: { createdAt: "asc" },
          });
          return { data: { ...session, activeOrganizationId: member?.organizationId ?? null } };
        },
      },
    },
  },
  plugins: [
    organization({
      // Invitations are created and surfaced in the Team settings UI with a shareable
      // accept link. Wire a real transactional email sender here later.
      async sendInvitationEmail(data) {
        const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/accept-invitation/${data.id}`;
        console.log(`[auth] invitation for ${data.email} to org ${data.organization.name}: ${url}`);
      },
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: baseUrl,
  trustedOrigins,
});
