import { SWRConfig } from "swr";
import TemplatesClient from "./TemplatesClient";
import { getTemplates } from "@/lib/queries";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const templates = tenant ? await getTemplates(tenant.orgId).catch(() => []) : [];
  return (
    <SWRConfig value={{ fallback: { "/api/templates": templates } }}>
      <TemplatesClient />
    </SWRConfig>
  );
}
