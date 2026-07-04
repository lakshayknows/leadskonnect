import { SWRConfig } from "swr";
import OverviewClient from "./OverviewClient";
import { getStats } from "@/lib/queries";

// Server Component: fetch stats on the server (co-located with the DB) and hand them
// to the client as SWR fallback for an instant first paint.
export const dynamic = "force-dynamic";

export default async function Page() {
  const stats = await getStats().catch(() => null);
  return (
    <SWRConfig value={{ fallback: { "/api/stats": stats } }}>
      <OverviewClient />
    </SWRConfig>
  );
}
