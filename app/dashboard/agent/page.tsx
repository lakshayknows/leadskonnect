import { SWRConfig } from "swr";
import AgentClient from "./AgentClient";
import { getLeadsPage, getSendingAccounts } from "@/lib/queries";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const EMPTY_LEADS = { items: [], total: 0, page: 1, pageSize: 200, totalPages: 1 };

export default async function Page() {
  const tenant = await getServerTenant();
  const [leads, accounts] = tenant
    ? await Promise.all([
        getLeadsPage(tenant.orgId, 1, 200).catch(() => EMPTY_LEADS),
        getSendingAccounts(tenant.orgId).catch(() => []),
      ])
    : [EMPTY_LEADS, []];
  return (
    <SWRConfig
      value={{
        fallback: {
          "/api/leads?pageSize=200": leads,
          "/api/sending-accounts": accounts,
        },
      }}
    >
      <AgentClient />
    </SWRConfig>
  );
}
