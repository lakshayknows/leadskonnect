import { SWRConfig } from "swr";
import OverviewClient from "./OverviewClient";
import { getStats } from "@/lib/queries";
import { getServerTenant } from "@/lib/tenant";

// Server Component: fetch stats on the server (co-located with the DB) and hand them
// to the client as SWR fallback for an instant first paint.
export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const stats = tenant ? await getStats(tenant.orgId).catch(() => null) : null;
  return (
    <SWRConfig value={{ fallback: { "/api/stats": stats } }}>
      <OverviewClient />
    </SWRConfig>
  );
}
