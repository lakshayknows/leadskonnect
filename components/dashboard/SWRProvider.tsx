"use client";

import { SWRConfig } from "swr";
import { api } from "@/lib/client";

const CACHE_KEY = "leadskonnect-swr-cache";

// Persist the SWR cache to localStorage so a full page reload paints instantly from
// the last-known data, then revalidates in the background (stale-while-revalidate).
function localStorageProvider() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<string, any>(JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"));
  window.addEventListener("beforeunload", () => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(map.entries())));
    } catch {
      /* quota / serialization issues are non-fatal */
    }
  });
  return map;
}

/**
 * Dashboard data layer. One shared fetcher (the existing `api` client), no refetch on
 * tab focus, dedup within 5s, and previous data kept during key changes (smooth
 * pagination). Cache persists across reloads and client navigations.
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (path: string) => api(path),
        revalidateOnFocus: false,
        keepPreviousData: true,
        dedupingInterval: 5000,
        provider: typeof window !== "undefined" ? localStorageProvider : undefined,
      }}
    >
      {children}
    </SWRConfig>
  );
}
