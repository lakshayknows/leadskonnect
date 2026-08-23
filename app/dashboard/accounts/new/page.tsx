import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { storefrontDomainsUrl, storefrontEmailUrl } from "@/lib/domains/storefront";
import { DashHeader } from "@/components/ui";
import NewDomainClient from "./NewDomainClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up a sending domain — Followthroo" };

export default function Page() {
  return (
    <>
      <DashHeader
        title="Set up a sending domain"
        subtitle="Buy a domain in the store, then we verify it and connect the mailbox."
        breadcrumb={
          <Link
            href="/dashboard/accounts"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Mailboxes &amp; domains
          </Link>
        }
      />
      {/* useSearchParams needs a Suspense boundary to keep the route static-safe. */}
      <Suspense fallback={<div className="p-8 text-sm text-ink-soft">Loading…</div>}>
        <NewDomainClient
          storeDomainsUrl={storefrontDomainsUrl()}
          storeEmailUrl={storefrontEmailUrl()}
        />
      </Suspense>
    </>
  );
}
