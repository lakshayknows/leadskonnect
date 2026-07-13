import { SWRConfig } from "swr";
import LeadsClient from "./LeadsClient";
import { getLeadsPage } from "@/lib/queries";
import { getServerTenant } from "@/lib/tenant";

// Seed the first page (page 1, no search) — the client's initial SWR key. Subsequent
// pages/searches are fetched client-side via SWR.
export const dynamic = "force-dynamic";

const EMPTY = { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 };

export default async function Page() {
  const tenant = await getServerTenant();
  // Matches the client's initial SWR key (default view = all contacts, no book filter).
  const first = tenant ? await getLeadsPage(tenant.orgId, 1, 50).catch(() => EMPTY) : EMPTY;
  return (
    <SWRConfig value={{ fallback: { "/api/leads?page=1&pageSize=50": first } }}>
      <LeadsClient />
    </SWRConfig>
  );
}
