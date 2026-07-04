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

/**
 * Normalize a URL env var so a small misconfig can't crash callers with "Invalid URL":
 * take the first entry if comma-listed, trim, prepend https:// only when NO scheme is
 * present (so redis://, rediss://, postgres:// etc. are preserved). Returns undefined
 * if it still isn't a valid URL, so a default / graceful-off can take over.
 */
function url(name: string): string | undefined {
  const raw = get(name);
  if (!raw) return undefined;
  let s = raw.split(",")[0].trim();
  if (!s) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  try {
    new URL(s);
    return s;
  } catch {
    return undefined;
  }
}

export const env = {
  appUrl: url("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  appSecret: get("APP_SECRET"),
  databaseUrl: get("DATABASE_URL"),
  redisUrl: url("REDIS_URL"),

  smtp: {
    host: get("SMTP_HOST"),
    port: num("SMTP_PORT", 587),
    secure: get("SMTP_SECURE") === "true",
    user: get("SMTP_USER"),
    pass: get("SMTP_PASS"),
    from: get("MAIL_FROM") ?? "LeadsKonnect <no-reply@example.com>",
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

  // Agent provider: NVIDIA (OpenAI-compatible endpoint).
  // Falls back to the bare BASE_URL / MODEL names if that's what's in .env.local.
  nvidia: {
    apiKey: get("NVIDIA_API_KEY"),
    baseUrl: url("NVIDIA_BASE_URL") ?? url("BASE_URL") ?? "https://integrate.api.nvidia.com/v1",
    model: get("NVIDIA_MODEL") ?? get("MODEL") ?? "meta/llama-3.3-70b-instruct",
  },

  limits: {
    emailPerHour: num("RL_EMAIL_PER_HOUR", 40),
    linkedinPerDay: num("RL_LINKEDIN_PER_DAY", 20),
    whatsappPerDay: num("RL_WHATSAPP_PER_DAY", 250),
  },
  qstash: {
    url: url("QSTASH_URL"),
    token: get("QSTASH_TOKEN"),
    currentSigningKey: get("QSTASH_CURRENT_SIGNING_KEY"),
    nextSigningKey: get("QSTASH_NEXT_SIGNING_KEY"),
  },

  // Google OAuth — powers "Connect Gmail" sending accounts (gmail.send scope).
  google: {
    clientId: get("GOOGLE_CLIENT_ID"),
    clientSecret: get("GOOGLE_CLIENT_SECRET"),
  },
};

export const configured = {
  db: !!env.databaseUrl,
  redis: !!env.redisUrl,
  email: !!(env.smtp.host && env.smtp.user && env.smtp.pass),
  whatsapp: !!(env.twilio.accountSid && env.twilio.authToken && env.twilio.whatsappFrom),
  linkedin: !!(env.linkedin.accessToken || env.linkedin.liAt),
  agent: !!env.nvidia.apiKey,
  qstash: !!(env.qstash.url && env.qstash.token),
  google: !!(env.google.clientId && env.google.clientSecret),
};
