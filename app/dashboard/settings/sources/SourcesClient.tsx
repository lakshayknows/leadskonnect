"use client";

import { useState } from "react";
import { Copy, Check, Pencil, AlertTriangle, PauseCircle, PlayCircle } from "lucide-react";
import useSWR from "swr";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import { DashHeader, Panel, Banner, Badge, Input, Label, Skeleton, usePrompt, useToast } from "@/components/ui";

type Source = {
  id: string;
  key: string;
  label: string;
  monthlyCost: number | null;
  active: boolean;
  instructions: string;
  ingestUrl: string;
  needsEnvSetup: boolean;
};

export default function SourcesClient() {
  const { data: sources, isLoading, mutate } = useSWR<Source[]>("/api/lead-sources");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const prompt = usePrompt();
  const toast = useToast();

  function copy(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  }

  async function patch(id: string, data: Partial<Pick<Source, "label" | "monthlyCost" | "active">>) {
    setMsg(null);
    try {
      await api("/api/lead-sources", { method: "PATCH", body: { id, ...data } });
      await mutate();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function rename(source: Source) {
    const label = await prompt({
      title: `Rename "${source.label}"`,
      label: "Source name",
      defaultValue: source.label,
      confirmLabel: "Rename",
    });
    if (!label || label === source.label) return;
    await patch(source.id, { label });
    toast("Renamed.");
  }

  async function saveCost(source: Source) {
    const raw = costDraft[source.id];
    if (raw === undefined) return;
    const monthlyCost = raw.trim() === "" ? null : Number(raw);
    if (monthlyCost !== null && (!Number.isFinite(monthlyCost) || monthlyCost < 0)) {
      setMsg("Monthly cost must be a positive number.");
      return;
    }
    await patch(source.id, { monthlyCost });
    setCostDraft((d) => {
      const next = { ...d };
      delete next[source.id];
      return next;
    });
    toast("Saved.");
  }

  return (
    <>
      <DashHeader
        title="Lead sources"
        subtitle="Where contacts come from — hand each URL to the platform that sends the lead."
      />

      <div className="mx-auto max-w-3xl space-y-4 p-8">
        {msg && <Banner kind="error">{msg}</Banner>}

        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}

        {!isLoading &&
          sources?.map((s) => {
            const draft = costDraft[s.id];
            const dirty = draft !== undefined && draft !== (s.monthlyCost?.toString() ?? "");
            return (
              <Panel key={s.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-base font-bold">{s.label}</h2>
                      <button
                        onClick={() => rename(s)}
                        className="rounded-lg p-1 text-ink-soft hover:bg-tint hover:text-ink"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 max-w-lg text-sm text-ink-soft">{s.instructions}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.needsEnvSetup && (
                      <Badge tone="warning">
                        <AlertTriangle className="h-3 w-3" /> Needs env setup
                      </Badge>
                    )}
                    <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Paused"}</Badge>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface-sunken px-3 py-2.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink-soft">{s.ingestUrl}</code>
                  <button
                    onClick={() => copy(s.ingestUrl, s.id)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium shadow-sm hover:bg-tint"
                  >
                    {copiedId === s.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === s.id ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                  <div className="w-40">
                    <Label htmlFor={`cost-${s.id}`}>Monthly cost (₹)</Label>
                    <Input
                      id={`cost-${s.id}`}
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder="0"
                      value={draft ?? s.monthlyCost?.toString() ?? ""}
                      onChange={(e) => setCostDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                      className="!py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {dirty && (
                      <button onClick={() => saveCost(s)} className="btn btn-primary !px-4 !py-2 text-xs">
                        Save
                      </button>
                    )}
                    <button
                      onClick={() => patch(s.id, { active: !s.active })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium transition-colors hover:bg-tint",
                      )}
                    >
                      {s.active ? (
                        <>
                          <PauseCircle className="h-3.5 w-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-3.5 w-3.5" /> Resume
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </Panel>
            );
          })}
      </div>
    </>
  );
}
