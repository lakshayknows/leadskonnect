"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { GitBranch, Clock, AlertTriangle, Building2 } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import { DashHeader, Panel, Banner, Select, EmptyState, Skeleton, Badge, usePrompt, useToast } from "@/components/ui";

type Item = {
  id: string; leadId: string; name: string; company: string | null; email: string | null;
  source: string | null; value: number | null; score: number | null; enteredStageAt: string;
  slaDueAt: string | null; overdue: boolean;
};
type Stage = { id: string; name: string; kind: "open" | "won" | "lost"; slaHours: number | null; items: Item[] };
type Board = { pipeline: { id: string; name: string; department: string }; stages: Stage[] } | null;
type PipelineSummary = { id: string; name: string; department: string; _count: { items: number } };

const TONE = { won: "success", lost: "danger", open: "neutral" } as const;

/** Score is a signal strength, not a status — quiet tones only. */
function scoreTone(score: number): "success" | "neutral" {
  return score >= 60 ? "success" : "neutral";
}

function sinceHours(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

export default function PipelineClient() {
  const [pipelineId, setPipelineId] = useState<string>("");
  const key = `/api/pipelines?view=board${pipelineId ? `&pipelineId=${pipelineId}` : ""}`;
  const { data: board, isLoading, mutate } = useSWR<Board>(key);
  const { data: pipelines = [] } = useSWR<PipelineSummary[]>("/api/pipelines");
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const prompt = usePrompt();
  const toast = useToast();

  async function move(itemId: string, toStageId: string) {
    const from = board?.stages.find((s) => s.items.some((i) => i.id === itemId));
    const to = board?.stages.find((s) => s.id === toStageId);
    if (!from || !to || from.id === to.id) return;

    const fromIdx = board!.stages.indexOf(from);
    const toIdx = board!.stages.indexOf(to);

    // A backward move needs a reason. Ask before calling, so the API's 422 is a
    // safety net rather than the way the user finds out.
    let reason: string | null = null;
    if (toIdx < fromIdx) {
      reason = await prompt({
        title: `Move back to "${to.name}"?`,
        body: `Going backwards from "${from.name}" is recorded on the contact's timeline.`,
        label: "Why is it moving back?",
        placeholder: "Budget fell through, needs re-qualifying…",
        confirmLabel: "Move back",
      });
      if (!reason) return;
    }

    // Optimistic: the board is a direct manipulation surface, so it must feel
    // immediate. A failure rolls back via revalidation.
    await mutate(
      async (current) => {
        await api("/api/pipeline-items", { method: "PATCH", body: { itemId, toStageId, reason } });
        return current;
      },
      {
        optimisticData: (current): Board => {
          if (!current) return null;
          const item = current.stages.flatMap((s) => s.items).find((i) => i.id === itemId);
          if (!item) return current;
          return {
            ...current,
            stages: current.stages.map((s) => ({
              ...s,
              items:
                s.id === toStageId
                  ? [...s.items.filter((i) => i.id !== itemId), item]
                  : s.items.filter((i) => i.id !== itemId),
            })),
          };
        },
        rollbackOnError: true,
        revalidate: true,
      },
    ).catch((e) => {
      setMsg({ kind: "error", text: (e as Error).message });
    });

    toast(`Moved to ${to.name}.`);
  }

  return (
    <>
      <DashHeader
        title="Pipeline"
        subtitle="Every department runs its own stages on the same engine."
        action={
          pipelines.length > 1 ? (
            <Select
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
              className="!w-56 !py-2 text-sm"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p._count.items}
                </option>
              ))}
            </Select>
          ) : null
        }
      />

      <div className="p-8">
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

        {isLoading && (
          <div className="flex gap-4 overflow-x-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-72 shrink-0 space-y-3">
                <Skeleton className="h-9 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && board && board.stages.every((s) => s.items.length === 0) && (
          <EmptyState
            icon={GitBranch}
            title="Nothing in the pipeline yet"
            body="Contacts land here automatically as leads arrive from your sources, or you can add them from the Contacts page."
          />
        )}

        {!isLoading && board && board.stages.some((s) => s.items.length > 0) && (
          // Horizontal scroll is contained here so the page body never scrolls sideways.
          <div className="flex gap-4 overflow-x-auto pb-4">
            {board.stages.map((stage) => (
              <section
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) move(dragId, stage.id);
                  setDragId(null);
                }}
                className="w-72 shrink-0"
                aria-label={stage.name}
              >
                <header className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-sunken px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{stage.name}</div>
                    {stage.slaHours && (
                      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                        {stage.slaHours}h SLA
                      </div>
                    )}
                  </div>
                  <Badge tone={TONE[stage.kind]}>{stage.items.length}</Badge>
                </header>

                <div className="space-y-2">
                  {stage.items.map((item) => (
                    <article
                      key={item.id}
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      onDragEnd={() => setDragId(null)}
                      className={cn(
                        "cursor-grab rounded-xl border bg-surface p-3 shadow-sm transition active:cursor-grabbing",
                        item.overdue ? "border-warning/40" : "border-line",
                        dragId === item.id && "opacity-50",
                      )}
                    >
                      {/* Only the title is a link — the card itself has to stay
                          draggable, and a full-card anchor swallows the drag. */}
                      <Link
                        href={`/dashboard/leads/${item.leadId}`}
                        draggable={false}
                        className="block truncate text-sm font-semibold hover:text-accent hover:underline"
                      >
                        {item.name}
                      </Link>
                      {item.company && (
                        <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-soft">
                          <Building2 className="h-3 w-3 shrink-0" /> {item.company}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {item.source && <Badge tone="neutral">{item.source}</Badge>}
                        {item.score != null && <Badge tone={scoreTone(item.score)}>{item.score}</Badge>}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-mono text-[10px]",
                            item.overdue ? "text-warning" : "text-ink-faint",
                          )}
                        >
                          {item.overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {sinceHours(item.enteredStageAt)}h
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
