/** Tiny browser-side fetch wrapper for the LeadsKonnect API ({ ok, data } shape). */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; raw?: BodyInit; contentType?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (opts.raw !== undefined) {
    body = opts.raw;
    if (opts.contentType) headers["content-type"] = opts.contentType;
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["content-type"] = "application/json";
  }

  const res = await fetch(path, { method: opts.method ?? (body ? "POST" : "GET"), headers, body });
  const j = await res.json().catch(() => ({ ok: false, error: res.statusText }));
  if (!j.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j.data as T;
}
