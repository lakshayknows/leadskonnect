import { SWRConfig } from "swr";
import OverviewClient from "./OverviewClient";
import { getStats, getActivation, getOnboardingState } from "@/lib/queries";
import { getServerTenant } from "@/lib/tenant";

// Server Component: fetch on the server (co-located with the DB) and hand the
// results to the client as SWR fallback for an instant first paint. Keys must
// match the URLs the client fetches exactly.
export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const [stats, activation, onboarding] = tenant
    ? await Promise.all([
        getStats(tenant.orgId).catch(() => null),
        getActivation(tenant.orgId).catch(() => null),
        getOnboardingState(tenant.userId).catch(() => null),
      ])
    : [null, null, null];

  return (
    <SWRConfig value={{ fallback: { "/api/stats": stats, "/api/activation": activation } }}>
      <OverviewClient checklistDismissed={!!onboarding?.checklistDismissedAt} />
    </SWRConfig>
  );
}
