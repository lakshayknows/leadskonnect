import { SWRConfig } from "swr";
import CampaignsClient from "./CampaignsClient";
import { getCampaigns, getTemplates, getSendingAccounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [campaigns, templates, accounts] = await Promise.all([
    getCampaigns().catch(() => []),
    getTemplates().catch(() => []),
    getSendingAccounts().catch(() => []),
  ]);
  return (
    <SWRConfig
      value={{
        fallback: {
          "/api/campaigns": campaigns,
          "/api/templates": templates,
          "/api/sending-accounts": accounts,
        },
      }}
    >
      <CampaignsClient />
    </SWRConfig>
  );
}
