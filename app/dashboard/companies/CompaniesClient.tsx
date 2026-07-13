"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Building2, Search, ArrowRight } from "lucide-react";
import { DashHeader, Panel, Input } from "@/components/dashboard/ui";

type Company = { company: string; count: number };

export default function CompaniesClient() {
  const { data = [], isLoading } = useSWR<Company[]>("/api/companies");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => data.filter((c) => c.company.toLowerCase().includes(q.trim().toLowerCase())),
    [data, q]
  );
  const totalContacts = data.reduce((n, c) => n + c.count, 0);

  return (
    <>
      <DashHeader title="Companies" subtitle={`${data.length.toLocaleString()} companies · ${totalContacts.toLocaleString()} contacts`} />

      <div className="space-y-4 p-8">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies…" className="!pl-9" />
        </div>

        {isLoading ? (
          <Panel><p className="text-sm text-ink-soft">Loading…</p></Panel>
        ) : filtered.length === 0 ? (
          <Panel>
            <div className="py-10 text-center">
              <Building2 className="mx-auto h-10 w-10 text-ink-soft/40" />
              <p className="mt-3 text-sm text-ink-soft">No companies yet. They appear as you add contacts with a company.</p>
            </div>
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <Link
                key={c.company}
                href={`/dashboard/companies/${encodeURIComponent(c.company)}`}
                className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:border-accent hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-display text-sm font-bold text-accent-strong">
                  {c.company.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.company}</div>
                  <div className="text-xs text-ink-soft">{c.count} contact{c.count === 1 ? "" : "s"}</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-soft/0 transition group-hover:text-accent" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
