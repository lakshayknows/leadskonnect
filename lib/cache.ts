/**
 * Tiny in-memory TTL cache for hot dashboard reads (stats, lead counts).
 * Fluid Compute reuses function instances, so this meaningfully cuts DB load as
 * data grows. TTL keeps entries fresh; mutations call invalidate() for immediacy.
 * Not a distributed cache — per-instance only, which is fine for these reads.
 */
type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

/** Drop cache entries. With a prefix, only matching keys; otherwise everything. */
export function invalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
