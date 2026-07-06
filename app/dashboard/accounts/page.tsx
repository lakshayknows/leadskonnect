import { SWRConfig } from "swr";
import AccountsClient from "./AccountsClient";
import { getSendingAccounts } from "@/lib/queries";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const accounts = tenant ? await getSendingAccounts(tenant.orgId).catch(() => []) : [];
  return (
    <SWRConfig value={{ fallback: { "/api/sending-accounts": accounts } }}>
      <AccountsClient />
    </SWRConfig>
  );
}
