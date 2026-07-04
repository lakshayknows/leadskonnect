"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Upload, Plus } from "lucide-react";
import { api } from "@/lib/client";
import { DashHeader, Panel, Banner, Input, Label } from "@/components/dashboard/ui";

type Lead = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  stage: string;
};

type LeadsResponse = { items: Lead[]; total: number; page: number; pageSize: number; totalPages: number };

const PAGE_SIZE = 50;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [form, setForm] = useState({ firstName: "", email: "", company: "" });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (p = page, q = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (q.trim()) params.set("q", q.trim());
    return api<LeadsResponse>(`/api/leads?${params}`)
      .then((r) => {
        setLeads(r.items);
        setTotal(r.total);
        setTotalPages(r.totalPages);
        setPage(r.page);
      })
      .catch((e) => setMsg({ kind: "error", text: e.message }))
      .finally(() => setLoading(false));
  };

  // Debounce search; reset to page 1 on a new query.
  useEffect(() => {
    const t = setTimeout(() => load(1, search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/leads", { body: form });
      setForm({ firstName: "", email: "", company: "" });
      setMsg({ kind: "success", text: "Lead added." });
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const text = await file.text();
      const res = await api<{ imported: number; skipped: number }>("/api/leads/import", {
        raw: text,
        contentType: "text/csv",
      });
      setMsg({ kind: "success", text: `Imported ${res.imported}, skipped ${res.skipped}.` });
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this lead? They'll be added to the suppression list.")) return;
    try {
      await api(`/api/leads/${id}`, { method: "DELETE" });
      // Reload so the total and current page stay correct after removal.
      load();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  return (
    <>
      <DashHeader
        title="Leads"
        subtitle={`${total.toLocaleString()} in your list`}
        action={
          <label className="btn btn-ghost !py-2 !text-sm cursor-pointer">
            <Upload className="h-4 w-4" /> Import CSV
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
            />
          </label>
        }
      />

      <div className="grid gap-6 p-8 lg:grid-cols-[320px_1fr]">
        {/* Add lead */}
        <Panel className="h-fit">
          <h2 className="font-display text-lg font-bold">Add a lead</h2>
          <form onSubmit={addLead} className="mt-4 space-y-3">
            <div>
              <Label>First name</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Jane" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@acme.com" />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme" />
            </div>
            <button disabled={busy} className="btn btn-primary w-full justify-center disabled:opacity-50">
              <Plus className="h-4 w-4" /> Add lead
            </button>
          </form>
          <p className="mt-4 font-mono text-xs text-ink-soft">
            CSV import maps unknown columns to personalization variables automatically.
          </p>
        </Panel>

        {/* List */}
        <div className="space-y-4">
          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or company…"
          />
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-tint font-mono text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft">Loading…</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft">No leads yet. Add one or import a CSV.</td></tr>
                ) : (
                  leads.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3 font-medium">{[l.firstName, l.lastName].filter(Boolean).join(" ") || "—"}</td>
                      <td className="px-4 py-3">{l.email}</td>
                      <td className="px-4 py-3 text-ink-soft">{l.company ?? "—"}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-tint px-2 py-0.5 font-mono text-xs">{l.stage}</span></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => del(l.id)} className="text-ink-soft transition-colors hover:text-red-600" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between text-sm text-ink-soft">
              <span className="font-mono text-xs">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => load(page - 1)}
                  disabled={loading || page <= 1}
                  className="rounded-lg border border-line px-3 py-1.5 transition hover:bg-tint disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="font-mono text-xs">
                  Page {page} / {totalPages}
                </span>
                <button
                  onClick={() => load(page + 1)}
                  disabled={loading || page >= totalPages}
                  className="rounded-lg border border-line px-3 py-1.5 transition hover:bg-tint disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
