import { SWRConfig } from "swr";
import SourcesClient from "./SourcesClient";
import { listSources } from "@/lib/lead-sources";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const sources = tenant ? await listSources(tenant.orgId).catch(() => null) : null;
  return (
    <SWRConfig value={{ fallback: { "/api/lead-sources": sources } }}>
      <SourcesClient />
    </SWRConfig>
  );
}
