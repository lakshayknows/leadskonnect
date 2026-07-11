/**
 * Template engine — mirrors docs/templates-and-variables.md.
 * Supports {{variable}} substitution and {{variable|fallback}} fallback syntax.
 *
 * NOTE: We intentionally avoid importing `handlebars` here because its Node.js
 * build uses `require.extensions` which is not supported by webpack / Next.js
 * and produces build warnings. This lightweight replacement covers the same
 * feature surface used by this project.
 */

export type Variables = Record<string, unknown>;

// Match {{var|fallback}} — captured as (var, fallback)
const FALLBACK_RE = /\{\{\s*([\w.]+)\s*\|\s*([^}]*?)\s*\}\}/g;
// Match {{var}} — plain variable reference
const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Resolve a dot-path like "lead.firstName" against a variables map. */
function resolve(path: string, vars: Variables): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, vars);
}

const cache = new Map<string, (vars: Variables) => string>();

/**
 * Compile a template string into a render function and cache it.
 * Supports:
 *   {{firstName}}          → variable substitution
 *   {{firstName|there}}    → fallback when the variable is empty / null / undefined
 */
function compile(template: string): (vars: Variables) => string {
  return (vars: Variables): string => {
    // First pass: resolve {{var|fallback}}
    let result = template.replace(FALLBACK_RE, (_m, name, fallback) => {
      const val = resolve(name, vars);
      if (val === undefined || val === null || val === "") return String(fallback);
      return String(val);
    });

    // Second pass: resolve {{var}}
    result = result.replace(VAR_RE, (_m, name) => {
      const val = resolve(name, vars);
      return val === undefined || val === null ? "" : String(val);
    });

    return result;
  };
}

export function render(template: string, variables: Variables): string {
  let fn = cache.get(template);
  if (!fn) {
    fn = compile(template);
    cache.set(template, fn);
  }
  return fn(variables);
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
    custom?: unknown;
  },
  opts: { senderName?: string } = {}
): RenderedMessage {
  const senderName = opts.senderName?.trim() || "";
  const vars: Variables = {
    firstName: lead.firstName ?? "",
    lastName: lead.lastName ?? "",
    company: lead.company ?? "",
    title: lead.title ?? "",
    email: lead.email ?? "",
    senderName,
    ...((lead.custom as Record<string, unknown>) ?? {}),
  };
  // Fill the legacy literal placeholder too, so pre-existing templates pick up the name.
  const fillSender = (s: string) => (senderName ? s.replace(/\[Your Name\]/gi, senderName) : s);
  return {
    subject: tpl.subject ? fillSender(render(tpl.subject, vars)) : undefined,
    body: fillSender(render(tpl.body, vars)),
  };
}

/**
 * Turn a plain-text template body (paragraphs separated by blank lines, single newlines as
 * line breaks) into readable HTML. Idempotent: bodies that already contain block-level HTML
 * (warm-up mail, hand-written HTML templates) are returned unchanged.
 */
export function formatEmailBody(body: string): string {
  if (!body) return body;
  if (/<(p|div|table|ul|ol|blockquote|h[1-6])[\s>]/i.test(body)) return body;
  const paras = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">${paras}</div>`;
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
