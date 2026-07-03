/**
 * Template engine — mirrors docs/templates-and-variables.md.
 * Handlebars for {{variable}} substitution, plus {{firstName|there}} fallback syntax.
 */
import Handlebars from "handlebars";

export type Variables = Record<string, unknown>;

// Pre-process {{ var | fallback }} → {{ fallback var "fallback" }} helper.
const FALLBACK_RE = /\{\{\s*([\w.]+)\s*\|\s*([^}]*?)\s*\}\}/g;

Handlebars.registerHelper("fallback", (value: unknown, fallback: unknown) => {
  if (value === undefined || value === null || value === "") return fallback;
  return value;
});

function preprocess(template: string): string {
  return template.replace(FALLBACK_RE, (_m, name, fb) => {
    const clean = String(fb).replace(/"/g, '\\"');
    return `{{fallback ${name} "${clean}"}}`;
  });
}

const cache = new Map<string, Handlebars.TemplateDelegate>();

export function render(template: string, variables: Variables): string {
  let compiled = cache.get(template);
  if (!compiled) {
    compiled = Handlebars.compile(preprocess(template), { noEscape: true });
    cache.set(template, compiled);
  }
  return compiled(variables);
}

export interface RenderedMessage {
  subject?: string;
  body: string;
}

/** Render a subject + body for a lead. `lead.custom` fields are flattened in. */
export function renderMessage(
  tpl: { subject?: string | null; body: string },
  lead: {
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null;
    title?: string | null;
    email?: string | null;
    custom?: Record<string, unknown> | null;
  }
): RenderedMessage {
  const vars: Variables = {
    firstName: lead.firstName ?? "",
    lastName: lead.lastName ?? "",
    company: lead.company ?? "",
    title: lead.title ?? "",
    email: lead.email ?? "",
    ...(lead.custom ?? {}),
  };
  return {
    subject: tpl.subject ? render(tpl.subject, vars) : undefined,
    body: render(tpl.body, vars),
  };
}

/** Naive spam-score heuristic — flag risky copy before a batch goes out. */
export function spamScore(text: string): { score: number; flags: string[] } {
  const flags: string[] = [];
  const t = text.toLowerCase();
  const triggers = ["free", "guarantee", "act now", "limited time", "click here", "$$$", "winner", "risk-free"];
  for (const w of triggers) if (t.includes(w)) flags.push(w);
  if ((text.match(/!/g) || []).length > 3) flags.push("excessive-exclamation");
  if (/[A-Z]{6,}/.test(text)) flags.push("shouting-caps");
  return { score: Math.min(flags.length / 5, 1), flags };
}
