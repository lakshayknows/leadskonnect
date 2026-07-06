import { SWRConfig } from "swr";
import InboxClient from "./InboxClient";
import { getInboxThreads } from "@/lib/queries";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const threads = tenant ? await getInboxThreads(tenant.orgId).catch(() => []) : [];
  return (
    <SWRConfig value={{ fallback: { "/api/inbox": threads } }}>
      <InboxClient />
    </SWRConfig>
  );
}
