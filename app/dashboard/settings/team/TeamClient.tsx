"use client";

import { useState } from "react";
import { UserPlus, Trash2, Building2, Copy, Check, Shield } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { DashHeader, Panel, Banner, Input, Select, Label } from "@/components/dashboard/ui";

type Role = "owner" | "admin" | "member";

const appUrl = typeof window !== "undefined" ? window.location.origin : "";

export default function TeamClient() {
  const { data: session } = useSession();
  const { data: org, isPending, refetch } = authClient.useActiveOrganization();
  const { data: orgs } = authClient.useListOrganizations();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: any[] = (org as any)?.members ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitations: any[] = ((org as any)?.invitations ?? []).filter((i: any) => i.status === "pending");
  const me = members.find((m) => m.userId === session?.user?.id);
  const canManage = me?.role === "owner" || me?.role === "admin";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await authClient.organization.inviteMember({ email: email.trim(), role });
    setBusy(false);
    if (res.error) return setMsg({ kind: "error", text: res.error.message ?? "Failed to invite" });
    setEmail("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = (res.data as any)?.id;
    setMsg({
      kind: "success",
      text: id ? `Invited ${email}. Share this link: ${appUrl}/accept-invitation/${id}` : `Invited ${email}.`,
    });
    refetch?.();
  }

  async function cancelInvite(invitationId: string) {
    await authClient.organization.cancelInvitation({ invitationId });
    refetch?.();
  }

  async function removeMember(memberIdOrEmail: string) {
    if (!confirm("Remove this member from the workspace?")) return;
    await authClient.organization.removeMember({ memberIdOrEmail });
    refetch?.();
  }

  async function changeRole(memberId: string, newRole: Role) {
    await authClient.organization.updateMemberRole({ memberId, role: newRole });
    refetch?.();
  }

  async function switchOrg(organizationId: string) {
    await authClient.organization.setActive({ organizationId });
    window.location.reload();
  }

  async function createOrg() {
    const name = prompt("New workspace name?");
    if (!name?.trim()) return;
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await authClient.organization.create({ name: name.trim(), slug });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = (res.data as any)?.id;
    if (id) await switchOrg(id);
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <DashHeader title="Team" subtitle="Manage who can access this workspace and their roles." />

      <div className="mx-auto max-w-4xl space-y-6 p-8">
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

        {/* Workspace switcher */}
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tint">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-lg font-bold">{org?.name ?? "Workspace"}</div>
                <div className="text-xs text-ink-soft">{members.length} member{members.length === 1 ? "" : "s"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {orgs && orgs.length > 1 && (
                <Select
                  value={org?.id ?? ""}
                  onChange={(e) => switchOrg(e.target.value)}
                  className="w-52"
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </Select>
              )}
              <button onClick={createOrg} className="btn btn-ghost whitespace-nowrap text-sm">
                New workspace
              </button>
            </div>
          </div>
        </Panel>

        {/* Invite */}
        {canManage && (
          <Panel>
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
              <UserPlus className="h-4 w-4" /> Invite a teammate
            </h2>
            <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="w-40">
                <Label>Role</Label>
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <button type="submit" disabled={busy} className="btn btn-primary text-sm">
                {busy ? "Inviting…" : "Send invite"}
              </button>
            </form>
          </Panel>
        )}

        {/* Members */}
        <Panel>
          <h2 className="mb-4 font-display text-base font-bold">Members</h2>
          {isPending ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : (
            <div className="divide-y divide-line">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.user?.name || m.user?.email}</div>
                    <div className="truncate text-xs text-ink-soft">{m.user?.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && m.role !== "owner" && m.userId !== session?.user?.id ? (
                      <Select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value as Role)}
                        className="w-28 !py-1.5 text-xs"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </Select>
                    ) : (
                      <span className="flex items-center gap-1 rounded-lg bg-tint px-2.5 py-1 text-xs font-medium capitalize">
                        {m.role === "owner" && <Shield className="h-3 w-3" />} {m.role}
                      </span>
                    )}
                    {canManage && m.role !== "owner" && m.userId !== session?.user?.id && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="rounded-lg p-1.5 text-ink-soft hover:bg-tint hover:text-red-600"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <Panel>
            <h2 className="mb-4 font-display text-base font-bold">Pending invitations</h2>
            <div className="divide-y divide-line">
              {invitations.map((inv) => {
                const link = `${appUrl}/accept-invitation/${inv.id}`;
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{inv.email}</div>
                      <div className="text-xs capitalize text-ink-soft">{inv.role} · pending</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copy(link, inv.id)}
                        className="flex items-center gap-1 rounded-lg bg-tint px-2.5 py-1.5 text-xs hover:bg-line"
                      >
                        {copied === inv.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === inv.id ? "Copied" : "Copy link"}
                      </button>
                      {canManage && (
                        <button
                          onClick={() => cancelInvite(inv.id)}
                          className="rounded-lg p-1.5 text-ink-soft hover:bg-tint hover:text-red-600"
                          title="Cancel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
