import CompanyDetailClient from "./CompanyDetailClient";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  return <CompanyDetailClient company={decodeURIComponent(company)} />;
}
