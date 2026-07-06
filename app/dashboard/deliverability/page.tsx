import { SWRConfig } from "swr";
import DeliverabilityClient from "./DeliverabilityClient";
import { getDeliverability } from "@/lib/deliverability";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const data = tenant ? await getDeliverability(tenant.orgId, 30).catch(() => null) : null;
  return (
    <SWRConfig value={{ fallback: { "/api/deliverability?days=30": data } }}>
      <DeliverabilityClient />
    </SWRConfig>
  );
}
