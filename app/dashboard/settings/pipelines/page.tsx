import { SWRConfig } from "swr";
import PipelinesClient from "./PipelinesClient";
import { listPipelines } from "@/lib/pipeline";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const pipelines = tenant ? await listPipelines(tenant.orgId).catch(() => null) : null;
  return (
    <SWRConfig value={{ fallback: { "/api/pipelines": pipelines } }}>
      <PipelinesClient />
    </SWRConfig>
  );
}
