import { SWRConfig } from "swr";
import AgentClient from "./AgentClient";
import { getLeadsPage, getSendingAccounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [leads, accounts] = await Promise.all([
    getLeadsPage(1, 200).catch(() => ({ items: [], total: 0, page: 1, pageSize: 200, totalPages: 1 })),
    getSendingAccounts().catch(() => []),
  ]);
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
