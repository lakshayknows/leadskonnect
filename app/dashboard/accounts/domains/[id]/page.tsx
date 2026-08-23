import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getServerTenant } from "@/lib/tenant";
import { DashHeader } from "@/components/ui";
import DomainDetailClient from "./DomainDetailClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  const tenant = await getServerTenant();

  // Scoped by org in the WHERE, so a guessed id 404s rather than leaking a name.
  const domain = tenant
    ? await prisma.domain
        .findFirst({
          where: { id, organizationId: tenant.orgId },
          select: { name: true },
        })
        .catch(() => null)
    : null;

  if (!domain) notFound();

  return (
    <>
      <DashHeader
        title={domain.name}
        subtitle="Sending domain — DNS health, mailboxes, and renewal."
        breadcrumb={
          <Link
            href="/dashboard/accounts"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Mailboxes &amp; domains
          </Link>
        }
      />
      <DomainDetailClient id={id} />
    </>
  );
}
