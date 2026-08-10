import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getServerTenant } from "@/lib/tenant";
import { getOnboardingState } from "@/lib/queries";

// Onboarding state is read here, on the server, so the tour is either in the
// first paint or absent entirely — never fetched client-side and flashed in.
// `getServerTenant` is React-cache'd, so the page below re-uses this lookup.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getServerTenant();
  const onboarding = tenant ? await getOnboardingState(tenant.userId).catch(() => null) : null;

  return <DashboardShell onboarding={onboarding}>{children}</DashboardShell>;
}
