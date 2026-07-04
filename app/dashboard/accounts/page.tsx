"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { DashHeader, Panel, Banner, Input, Select, Label } from "@/components/dashboard/ui";
import { Trash2, ShieldCheck, Mail, Server, RefreshCw } from "lucide-react";

type SendingAccount = {
  id: string;
  name: string;
  email: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string | null;
  active: boolean;
  createdAt: string;
};

export default function SendingAccountsPage() {
  const [accounts, setAccounts] = useState<SendingAccount[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    from: "",
  });
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  const load = () =>
    api<SendingAccount[]>("/api/sending-accounts")
      .then(setAccounts)
      .catch((err) => {
        console.error("Failed to load accounts:", err);
      });

  useEffect(() => {
    load();
  }, []);

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setForm((prev) => ({
      ...prev,
      port: isNaN(val) ? 587 : val,
    }));
  };

  async function testConnection(e: React.MouseEvent) {
    e.preventDefault();
    if (!form.host || !form.email || !form.user || !form.pass) {
      setMsg({ kind: "error", text: "Please fill in email, host, user, and password to test connection." });
      return;
    }
    setTestBusy(true);
    setMsg(null);
    try {
      const res = await api<{ message: string }>("/api/sending-accounts?test=true", {
        body: form,
      });
      setMsg({ kind: "success", text: res.message || "SMTP connection verified successfully!" });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setTestBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/sending-accounts", { body: form });
      setForm({
        name: "",
        email: "",
        host: "",
        port: 587,
        secure: false,
        user: "",
        pass: "",
        from: "",
      });
      setMsg({ kind: "success", text: "Sending account saved." });
      load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Are you sure you want to delete this sending account?")) return;
    try {
      await api(`/api/sending-accounts?id=${id}`, { method: "DELETE" });
      setMsg({ kind: "success", text: "Sending account deleted." });
      load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <>
      <DashHeader
        title="Sending Accounts"
        subtitle="Manage SMTP email accounts to send automated campaigns and agent outreach."
      />
      <div className="grid gap-6 p-8 lg:grid-cols-[380px_1fr]">
        <Panel className="h-fit">
          <h2 className="font-display text-lg font-bold">Connect Email Account</h2>
          <form onSubmit={create} className="mt-4 space-y-3">
            <div>
              <Label>Account Name *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sales Gmail, Work Account"
              />
            </div>
            <div>
              <Label>Sender Email *</Label>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. user@yourdomain.com"
              />
            </div>
            <div>
              <Label>SMTP Host *</Label>
              <Input
                required
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="e.g. smtp.gmail.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>SMTP Port *</Label>
                <Input
                  required
                  type="number"
                  value={form.port}
                  onChange={handlePortChange}
                  placeholder="587"
                />
              </div>
              <div>
                <Label>Connection Security</Label>
                <Select
                  value={form.secure ? "ssl" : "tls"}
                  onChange={(e) => setForm({ ...form, secure: e.target.value === "ssl" })}
                >
                  <option value="tls">STARTTLS (Port 587/25)</option>
                  <option value="ssl">SSL/TLS (Port 465)</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Username *</Label>
              <Input
                required
                value={form.user}
                onChange={(e) => setForm({ ...form, user: e.target.value })}
                placeholder="SMTP User (often matches email)"
              />
            </div>
            <div>
              <Label>Password / App Password *</Label>
              <Input
                required
                type="password"
                value={form.pass}
                onChange={(e) => setForm({ ...form, pass: e.target.value })}
                placeholder="App Password / Credentials"
              />
            </div>
            <div>
              <Label>Custom From Name (Optional)</Label>
              <Input
                value={form.from || ""}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                placeholder='e.g. "Jane Doe <jane@company.com>"'
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={testConnection}
                disabled={testBusy || busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm font-medium transition hover:bg-tint disabled:opacity-50"
              >
                {testBusy ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                )}
                Test SMTP
              </button>
              <button
                type="submit"
                disabled={busy || testBusy}
                className="btn btn-primary flex flex-1 justify-center disabled:opacity-50"
              >
                Save Account
              </button>
            </div>
          </form>
        </Panel>

        <div className="space-y-4">
          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
          {accounts.length === 0 ? (
            <Panel>
              <p className="text-sm text-ink-soft">
                No custom sending accounts configured. Campaigns and AI Agent will fall back to using default server settings.
              </p>
            </Panel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {accounts.map((acc) => (
                <Panel key={acc.id} className="relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-action" />
                      <h3 className="font-display font-bold">{acc.name}</h3>
                      {acc.active && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink font-medium">{acc.email}</p>
                    <div className="mt-3 flex items-center gap-1.5 font-mono text-xs text-ink-soft">
                      <Server className="h-3.5 w-3.5" />
                      <span>
                        {acc.host}:{acc.port} ({acc.secure ? "SSL" : "TLS"})
                      </span>
                    </div>
                    {acc.from && (
                      <p className="mt-2 text-xs text-ink-soft">
                        From header: <span className="font-mono">{acc.from}</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                    <span className="text-[10px] text-ink-soft">
                      Added {new Date(acc.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => remove(acc.id)}
                      className="rounded-lg p-1.5 text-ink-soft hover:bg-red-50 hover:text-red-600 transition"
                      title="Delete account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
