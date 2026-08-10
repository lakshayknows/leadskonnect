import { SWRConfig } from "swr";
import PipelineClient from "./PipelineClient";
import { getBoard } from "@/lib/pipeline";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const board = tenant ? await getBoard(tenant.orgId).catch(() => null) : null;
  return (
    <SWRConfig value={{ fallback: { "/api/pipelines?view=board": board } }}>
      <PipelineClient />
    </SWRConfig>
  );
}
