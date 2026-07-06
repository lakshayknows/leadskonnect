"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Trash2, Upload, Plus, Tag, FolderPlus, Rocket, X, Pencil, Check, Users } from "lucide-react";
import { api } from "@/lib/client";
import { DashHeader, Panel, Banner, Input, Label, Select } from "@/components/dashboard/ui";

type Lead = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  stage: string;
  tags: string[];
};

type LeadsResponse = { items: Lead[]; total: number; page: number; pageSize: number; totalPages: number };
type Segment = { id: string; name: string; kind: string; count: number; leadIds: string[] };
type Campaign = { id: string; name: string };

const PAGE_SIZE = 50;

export default function LeadsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [form, setForm] = useState({ firstName: "", email: "", company: "", tags: "" });
  const [busy, setBusy] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string } | null>(null);
  const [managingGroup, setManagingGroup] = useState<Segment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
  if (tagFilter.length) params.set("tags", tagFilter.join(","));
  const { data, isLoading, error, mutate } = useSWR<LeadsResponse>(`/api/leads?${params}`);
  const { data: segments, mutate: mutateSegments } = useSWR<Segment[]>("/api/segments");
  const { data: campaigns } = useSWR<Campaign[]>("/api/campaigns");

  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // All tags seen on the current page (for quick filter chips).
  const pageTags = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => l.tags?.forEach((t) => s.add(t)));
    tagFilter.forEach((t) => s.add(t));
    return Array.from(s).sort();
  }, [leads, tagFilter]);

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (leads.every((l) => prev.has(l.id))) {
        const next = new Set(prev);
        leads.forEach((l) => next.delete(l.id));
        return next;
      }
      return new Set([...prev, ...leads.map((l) => l.id)]);
    });
  }

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) return;
    setBusy(true);
    setMsg(null);
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      await api("/api/leads", { body: { firstName: form.firstName, email: form.email, company: form.company, tags } });
      setForm({ firstName: "", email: "", company: "", tags: "" });
      setMsg({ kind: "success", text: "Lead added." });
      mutate();
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
      const res = await api<{ imported: number; skipped: number }>("/api/leads/import", { raw: text, contentType: "text/csv" });
      setMsg({ kind: "success", text: `Imported ${res.imported}, skipped ${res.skipped}.` });
      mutate();
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
      mutate();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  // ---- Bulk actions on the current selection ----
  const selectedIds = () => Array.from(selected);

  async function bulkAddTag() {
    const tag = prompt("Tag to add to selected leads:");
    if (!tag?.trim()) return;
    await api("/api/leads/bulk", { body: { leadIds: selectedIds(), addTags: [tag.trim()] } });
    setMsg({ kind: "success", text: `Tagged ${selected.size} lead(s) “${tag.trim()}”.` });
    mutate();
  }

  async function bulkAddToGroup(segmentId: string) {
    if (!segmentId) return;
    await api("/api/leads/bulk", { body: { leadIds: selectedIds(), segmentId } });
    setMsg({ kind: "success", text: `Added ${selected.size} lead(s) to group.` });
    mutateSegments();
  }

  async function bulkEnroll(campaignId: string) {
    if (!campaignId) return;
    if (!confirm(`Enroll ${selected.size} selected lead(s) into this campaign?`)) return;
    try {
      const res = await api<{ enrolled: number; skipped: number }>(`/api/campaigns/${campaignId}/enroll`, {
        body: { leadIds: selectedIds() },
      });
      setMsg({ kind: "success", text: `Enrolled ${res.enrolled}, skipped ${res.skipped} already in campaign.` });
      setSelected(new Set());
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  async function createGroupFromSelection() {
    if (!newGroup.trim()) return;
    const groupName = newGroup.trim();
    const count = selected.size;
    await api("/api/segments", { body: { name: groupName, kind: "static", leadIds: selectedIds() } });
    setNewGroup("");
    setMsg({
      kind: "success",
      text: count > 0
        ? `Group "${groupName}" created with ${count} lead(s).`
        : `Group "${groupName}" created. Select leads and use "Add to group" to populate it.`,
    });
    mutateSegments();
  }

  async function deleteGroup(id: string) {
    if (!confirm("Delete this group? (Leads are not deleted.)")) return;
    await api(`/api/segments?id=${id}`, { method: "DELETE" });
    mutateSegments();
  }

  async function renameGroup(id: string, name: string) {
    if (!name.trim()) return;
    await api("/api/segments", { method: "PATCH", body: { id, name: name.trim() } });
    setEditingGroup(null);
    mutateSegments();
  }

  async function createGroupFromTag(tag: string) {
    // Collect all lead IDs that have this tag from the current page
    const tagLeads = leads.filter((l) => l.tags?.includes(tag)).map((l) => l.id);
    await api("/api/segments", { body: { name: tag, kind: "static", leadIds: tagLeads } });
    setMsg({ kind: "success", text: `Group "${tag}" created with ${tagLeads.length} lead(s) from this page.` });
    mutateSegments();
  }

  return (
    <>
      <DashHeader
        title="Leads"
        subtitle={`${total.toLocaleString()} in your list`}
        action={
          <label className="btn btn-ghost !py-2 !text-sm cursor-pointer">
            <Upload className="h-4 w-4" /> Import CSV
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          </label>
        }
      />

      <div className="grid gap-6 p-8 lg:grid-cols-[320px_1fr]">
        {/* Left column */}
        <div className="space-y-6">
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
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, warm" />
              </div>
              <button disabled={busy} className="btn btn-primary w-full justify-center disabled:opacity-50">
                <Plus className="h-4 w-4" /> Add lead
              </button>
            </form>
          </Panel>

          <Panel className="h-fit">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <FolderPlus className="h-4 w-4" /> Groups
              <span className="ml-auto font-mono text-[10px] font-normal uppercase tracking-wider text-ink-soft">= Tags</span>
            </h2>
            <p className="mt-1 text-xs text-ink-soft">Static lists — same as tags. Target with a campaign launch.</p>
            <div className="mt-3 space-y-2">
              {(segments ?? []).length === 0 && <p className="text-sm text-ink-soft">No groups yet.</p>}
              {(segments ?? []).map((s) => (
                <div key={s.id} className="rounded-xl border border-line text-sm">
                  {editingGroup?.id === s.id ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Input
                        autoFocus
                        value={editingGroup.name}
                        onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameGroup(s.id, editingGroup.name);
                          if (e.key === "Escape") setEditingGroup(null);
                        }}
                        className="!py-1 !text-sm"
                      />
                      <button onClick={() => renameGroup(s.id, editingGroup.name)} className="shrink-0 text-emerald-600 hover:text-emerald-700" title="Save">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingGroup(null)} className="shrink-0 text-ink-soft hover:text-ink" title="Cancel">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="truncate font-medium">{s.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded-full bg-tint px-2 py-0.5 font-mono text-xs">{s.count}</span>
                        <button onClick={() => setManagingGroup(s)} className="text-ink-soft hover:text-indigo-600" aria-label="Edit members" title="Edit members">
                          <Users className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingGroup({ id: s.id, name: s.name })} className="text-ink-soft hover:text-ink" aria-label="Rename group">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteGroup(s.id)} className="text-ink-soft hover:text-red-600" aria-label="Delete group">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Create group */}
            <div className="mt-4 space-y-2">
              <Input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="Group name…"
                onKeyDown={(e) => e.key === "Enter" && createGroupFromSelection()}
              />
              <button
                onClick={createGroupFromSelection}
                disabled={!newGroup.trim()}
                className="btn btn-primary w-full justify-center !py-2 !text-sm disabled:opacity-40"
              >
                <FolderPlus className="h-4 w-4" />
                {selected.size > 0 ? `Create group with ${selected.size} lead(s)` : "Create group"}
              </button>
              {selected.size === 0 && (
                <p className="text-center text-xs text-ink-soft">
                  Select leads from the table to add them to the new group,<br />or create an empty group and add leads later.
                </p>
              )}
            </div>
          </Panel>
        </div>

        {/* List */}
        <div className="space-y-4">
          {msg ? <Banner kind={msg.kind}>{msg.text}</Banner> : error ? <Banner kind="error">{(error as Error).message}</Banner> : null}

          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, or company…" />

          {/* Tag filter chips — click to filter, long-press hint to create group */}
          {pageTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase text-ink-soft">Filter / Tags:</span>
              {pageTags.map((t) => {
                const on = tagFilter.includes(t);
                const alreadyGroup = (segments ?? []).some((s) => s.name === t);
                return (
                  <div key={t} className="flex items-center gap-0.5">
                    <button
                      onClick={() => { setPage(1); setTagFilter((f) => (on ? f.filter((x) => x !== t) : [...f, t])); }}
                      className={`flex items-center gap-1 rounded-l-full px-2.5 py-1 text-xs transition ${on ? "bg-ink text-white" : "bg-tint text-ink-soft hover:text-ink"}`}
                    >
                      <Tag className="h-3 w-3" /> {t} {on && <X className="h-3 w-3" />}
                    </button>
                    {!alreadyGroup && (
                      <button
                        onClick={() => createGroupFromTag(t)}
                        title={`Create group "${t}"`}
                        className="rounded-r-full bg-tint px-1.5 py-1 text-xs text-ink-soft transition hover:bg-indigo-100 hover:text-indigo-600"
                      >
                        <FolderPlus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink bg-ink px-4 py-2.5 text-sm text-white">
              <span className="font-medium">{selected.size} selected</span>
              <button onClick={bulkAddTag} className="flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 hover:bg-white/25">
                <Tag className="h-3.5 w-3.5" /> Add tag
              </button>
              <Select onChange={(e) => { bulkAddToGroup(e.target.value); e.target.value = ""; }} className="!w-40 !bg-white/15 !text-white !border-white/20 !py-1 text-xs" defaultValue="">
                <option value="" className="text-ink">Add to group…</option>
                {(segments ?? []).map((s) => <option key={s.id} value={s.id} className="text-ink">{s.name}</option>)}
              </Select>
              <Select onChange={(e) => { bulkEnroll(e.target.value); e.target.value = ""; }} className="!w-44 !bg-white/15 !text-white !border-white/20 !py-1 text-xs" defaultValue="">
                <option value="" className="text-ink">Enroll in campaign…</option>
                {(campaigns ?? []).map((c) => <option key={c.id} value={c.id} className="text-ink">{c.name}</option>)}
              </Select>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-white/70 hover:text-white">Clear</button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-tint font-mono text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-soft">Loading…</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-soft">No leads found.</td></tr>
                ) : (
                  leads.map((l) => (
                    <tr key={l.id} className={selected.has(l.id) ? "bg-tint/50" : ""}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.email}`} />
                      </td>
                      <td className="px-4 py-3 font-medium">{[l.firstName, l.lastName].filter(Boolean).join(" ") || "—"}</td>
                      <td className="px-4 py-3">{l.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(l.tags ?? []).map((t) => <span key={t} className="rounded-full bg-tint px-2 py-0.5 text-xs">{t}</span>)}
                        </div>
                      </td>
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

          {total > 0 && (
            <div className="flex items-center justify-between text-sm text-ink-soft">
              <span className="font-mono text-xs">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={isLoading || page <= 1} className="rounded-lg border border-line px-3 py-1.5 transition hover:bg-tint disabled:opacity-40">Prev</button>
                <span className="font-mono text-xs">Page {page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={isLoading || page >= totalPages} className="rounded-lg border border-line px-3 py-1.5 transition hover:bg-tint disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Group members modal ---- */}
      {managingGroup && (
        <GroupMembersModal
          segment={managingGroup}
          selectedLeadIds={Array.from(selected)}
          onClose={() => setManagingGroup(null)}
          onSaved={() => { mutateSegments(); setManagingGroup(null); }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// GroupMembersModal — view / remove / add leads inside a group
// ---------------------------------------------------------------------------

type GroupMembersModalProps = {
  segment: { id: string; name: string; leadIds: string[] };
  selectedLeadIds: string[];   // leads selected in the main table to quick-add
  onClose: () => void;
  onSaved: () => void;
};

function GroupMembersModal({ segment, selectedLeadIds, onClose, onSaved }: GroupMembersModalProps) {
  // Local copy of leadIds so changes are staged before saving
  const [pendingIds, setPendingIds] = useState<string[]>(segment.leadIds);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // Fetch the actual lead objects for the current pendingIds
  const idsParam = pendingIds.join(",");
  const { data, isLoading } = useSWR<{ items: Lead[] }>(
    pendingIds.length ? `/api/leads?ids=${idsParam}&pageSize=500` : null
  );
  const members = data?.items ?? [];

  const filtered = memberSearch.trim()
    ? members.filter(
        (l) =>
          `${l.firstName ?? ""} ${l.lastName ?? ""} ${l.email} ${l.company ?? ""}`
            .toLowerCase()
            .includes(memberSearch.toLowerCase())
      )
    : members;

  // Leads selected in the parent table that aren't already in this group
  const addable = selectedLeadIds.filter((id) => !pendingIds.includes(id));

  function removeLead(id: string) {
    setPendingIds((prev) => prev.filter((x) => x !== id));
  }

  function addSelected() {
    setPendingIds((prev) => Array.from(new Set([...prev, ...addable])));
  }

  async function save() {
    setSaving(true);
    try {
      await api("/api/segments", { method: "PATCH", body: { id: segment.id, leadIds: pendingIds } });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify([...pendingIds].sort()) !== JSON.stringify([...segment.leadIds].sort());

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-lg flex-col rounded-2xl border border-line bg-white shadow-2xl"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h3 className="font-display text-base font-bold">Edit members — {segment.name}</h3>
            <p className="mt-0.5 text-xs text-ink-soft">{pendingIds.length} lead(s) in group</p>
          </div>
          <button onClick={onClose} className="text-ink-soft hover:text-ink"><X className="h-5 w-5" /></button>
        </div>

        {/* Quick-add bar */}
        {addable.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-line bg-indigo-50 px-5 py-3">
            <span className="text-xs text-indigo-700">
              <strong>{addable.length}</strong> selected lead(s) not in this group
            </span>
            <button
              onClick={addSelected}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add to group
            </button>
          </div>
        )}

        {/* Search */}
        <div className="border-b border-line px-5 py-3">
          <input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search within group…"
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {isLoading && <p className="text-sm text-ink-soft">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-soft">
              {pendingIds.length === 0 ? "Group is empty." : "No matches."}
            </p>
          )}
          {filtered.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{[l.firstName, l.lastName].filter(Boolean).join(" ") || l.email}</p>
                <p className="truncate text-xs text-ink-soft">{l.email}{l.company ? ` · ${l.company}` : ""}</p>
              </div>
              <button
                onClick={() => removeLead(l.id)}
                className="shrink-0 rounded-full p-1 text-ink-soft transition hover:bg-red-50 hover:text-red-600"
                title="Remove from group"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold transition hover:bg-tint">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : `Save changes${dirty ? ` (${pendingIds.length} leads)` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
