import { SWRConfig } from "swr";
import LeadsClient from "./LeadsClient";
import { getLeadsPage } from "@/lib/queries";

// Seed the first page (page 1, no search) — the client's initial SWR key. Subsequent
// pages/searches are fetched client-side via SWR.
export const dynamic = "force-dynamic";

export default async function Page() {
  const first = await getLeadsPage(1, 50).catch(() => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
  }));
  return (
    <SWRConfig value={{ fallback: { "/api/leads?page=1&pageSize=50": first } }}>
      <LeadsClient />
    </SWRConfig>
  );
}
