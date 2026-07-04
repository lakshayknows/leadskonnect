"use client";

import { SWRConfig } from "swr";
import { api } from "@/lib/client";

/**
 * Dashboard data layer. One shared fetcher (the existing `api` client), no refetch on
 * tab focus, dedup within 5s, previous data kept during key changes (smooth pagination).
 *
 * Cache is IN-MEMORY ONLY — no localStorage — so no lead/account data is written to
 * disk (security). Fast first paint comes from server-rendered SWR fallback instead
 * (see each dashboard page.tsx), and navigation stays instant via the in-memory cache.
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (path: string) => api(path),
        revalidateOnFocus: false,
        keepPreviousData: true,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
