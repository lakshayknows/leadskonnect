/**
 * Email open/click tracking.
 *
 * Before an email is sent we rewrite outbound links to a click-redirector and append a
 * 1×1 open pixel — both keyed by the Message id. The tracking routes (unauthenticated,
 * hit from the recipient's inbox) resolve the Message, write an ActivityLog(opened|clicked),
 * and — for clicks — 302 to the original URL. Reports and the campaign condition nodes
 * ("opened" / "clicked") read those events.
 */
import { env } from "./env";

/** 1×1 transparent GIF. */
export const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const HREF_RE = /href\s*=\s*"(https?:\/\/[^"]+)"/gi;

/** Rewrite links + inject the open pixel. Only touches http(s) links. */
export function injectTracking(html: string, messageId: string, appUrl = env.appUrl): string {
  const base = appUrl.replace(/\/$/, "");

  const rewritten = html.replace(HREF_RE, (_m, url: string) => {
    // Don't double-wrap our own tracking/unsubscribe links.
    if (url.startsWith(`${base}/api/track/`)) return `href="${url}"`;
    return `href="${base}/api/track/click/${messageId}?u=${encodeURIComponent(url)}"`;
  });

  const pixel = `<img src="${base}/api/track/open/${messageId}" width="1" height="1" alt="" style="display:none;border:0" />`;
  return /<\/body>/i.test(rewritten)
    ? rewritten.replace(/<\/body>/i, `${pixel}</body>`)
    : rewritten + pixel;
}
