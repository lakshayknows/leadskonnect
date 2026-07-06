import { SWRConfig } from "swr";
import ReportsClient from "./ReportsClient";
import { getReport } from "@/lib/reports";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const report = tenant ? await getReport(tenant.orgId, 30).catch(() => null) : null;
  return (
    <SWRConfig value={{ fallback: { "/api/reports?days=30": report } }}>
      <ReportsClient />
    </SWRConfig>
  );
}
