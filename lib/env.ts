/**
 * Central env access. Nothing throws at import time — every integration reports
 * whether it is configured, so the app boots even with a partial .env.local.
 */

function get(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function num(name: string, fallback: number): number {
  const v = get(name);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  appUrl: get("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  appSecret: get("APP_SECRET"),
  databaseUrl: get("DATABASE_URL"),
  redisUrl: get("REDIS_URL"),

  smtp: {
    host: get("SMTP_HOST"),
    port: num("SMTP_PORT", 587),
    secure: get("SMTP_SECURE") === "true",
    user: get("SMTP_USER"),
    pass: get("SMTP_PASS"),
    from: get("MAIL_FROM") ?? "Overture <no-reply@example.com>",
    dkim: {
      domainName: get("DKIM_DOMAIN"),
      keySelector: get("DKIM_KEY_SELECTOR") ?? "default",
      privateKey: get("DKIM_PRIVATE_KEY"),
    },
  },

  twilio: {
    accountSid: get("TWILIO_ACCOUNT_SID"),
    authToken: get("TWILIO_AUTH_TOKEN"),
    whatsappFrom: get("TWILIO_WHATSAPP_FROM"),
  },

  linkedin: {
    clientId: get("LINKEDIN_CLIENT_ID"),
    clientSecret: get("LINKEDIN_CLIENT_SECRET"),
    accessToken: get("LINKEDIN_ACCESS_TOKEN"),
    liAt: get("LINKEDIN_LI_AT"),
  },

  anthropic: {
    apiKey: get("ANTHROPIC_API_KEY"),
    model: get("ANTHROPIC_MODEL") ?? "claude-opus-4-8",
  },

  limits: {
    emailPerHour: num("RL_EMAIL_PER_HOUR", 40),
    linkedinPerDay: num("RL_LINKEDIN_PER_DAY", 20),
    whatsappPerDay: num("RL_WHATSAPP_PER_DAY", 250),
  },
};

export const configured = {
  db: !!env.databaseUrl,
  redis: !!env.redisUrl,
  email: !!(env.smtp.host && env.smtp.user && env.smtp.pass),
  whatsapp: !!(env.twilio.accountSid && env.twilio.authToken && env.twilio.whatsappFrom),
  linkedin: !!(env.linkedin.accessToken || env.linkedin.liAt),
  anthropic: !!env.anthropic.apiKey,
};
