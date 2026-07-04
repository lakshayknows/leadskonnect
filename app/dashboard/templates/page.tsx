import { SWRConfig } from "swr";
import TemplatesClient from "./TemplatesClient";
import { getTemplates } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const templates = await getTemplates().catch(() => []);
  return (
    <SWRConfig value={{ fallback: { "/api/templates": templates } }}>
      <TemplatesClient />
    </SWRConfig>
  );
}
