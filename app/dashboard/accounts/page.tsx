import { SWRConfig } from "swr";
import AccountsClient from "./AccountsClient";
import { getSendingAccounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const accounts = await getSendingAccounts().catch(() => []);
  return (
    <SWRConfig value={{ fallback: { "/api/sending-accounts": accounts } }}>
      <AccountsClient />
    </SWRConfig>
  );
}
