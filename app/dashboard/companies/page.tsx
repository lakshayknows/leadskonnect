import { SWRConfig } from "swr";
import CompaniesClient from "./CompaniesClient";
import { getCompanies } from "@/lib/queries";
import { getServerTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Page() {
  const tenant = await getServerTenant();
  const companies = tenant ? await getCompanies(tenant.orgId).catch(() => []) : [];
  return (
    <SWRConfig value={{ fallback: { "/api/companies": companies } }}>
      <CompaniesClient />
    </SWRConfig>
  );
}
