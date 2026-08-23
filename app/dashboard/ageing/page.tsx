import AgeingClient from "./AgeingClient";
import { AnalyzeNav } from "@/components/dashboard/AnalyzeNav";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <AnalyzeNav />
      <AgeingClient />
    </>
  );
}
