"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { DashHeader, Panel, Banner, Input, Label } from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const { data: session, refetch } = useSession();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setMsg({ kind: "error", text: "Name can't be empty." });
    setBusy(true);
    setMsg(null);
    const res = await authClient.updateUser({ name: name.trim() });
    setBusy(false);
    if (res.error) return setMsg({ kind: "error", text: res.error.message ?? "Couldn't save." });
    refetch?.();
    setMsg({ kind: "success", text: "Profile saved. New outreach will sign off with this name." });
  }

  return (
    <>
      <DashHeader title="Profile" subtitle="Your name signs your outreach — it fills {{senderName}} / [Your Name] in templates." />
      <div className="max-w-lg p-8">
        <Panel>
          <form onSubmit={save} className="space-y-4">
            {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
                {(name || session?.user?.email || "U").slice(0, 1).toUpperCase()}
              </span>
              <div className="text-sm text-ink-soft">This name appears at the bottom of your emails.</div>
            </div>
            <div>
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={session?.user?.email ?? ""} readOnly className="!bg-tint text-ink-soft" />
            </div>
            <button disabled={busy} className="btn btn-primary justify-center disabled:opacity-50">
              <User className="h-4 w-4" /> {busy ? "Saving…" : "Save profile"}
            </button>
          </form>
        </Panel>
      </div>
    </>
  );
}
