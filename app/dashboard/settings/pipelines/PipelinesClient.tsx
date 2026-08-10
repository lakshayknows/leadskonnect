"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  GitBranch, Plus, Trash2, Pencil, ChevronUp, ChevronDown, Clock,
} from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import {
  DashHeader, Panel, Banner, Badge, Input, Label, Select, Skeleton, EmptyState, useConfirm, usePrompt, useToast,
} from "@/components/ui";

type StageKind = "open" | "won" | "lost";
type Stage = { id: string; name: string; kind: StageKind; slaHours: number | null; position: number };
type AssignmentRule = "manual" | "round_robin" | "workload";
type PipelineRow = {
  id: string;
  name: string;
  department: Department;
  isDefault: boolean;
  assignmentRule: AssignmentRule;
  stages: Stage[];
  _count: { items: number };
};
type Department = "marketing" | "sales" | "support" | "collections" | "recruitment";

const ASSIGNMENT_RULES: { value: AssignmentRule; label: string }[] = [
  { value: "manual", label: "Manual (nobody auto-assigned)" },
  { value: "round_robin", label: "Round robin" },
  { value: "workload", label: "Least busy rep" },
];

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "support", label: "Support" },
  { value: "collections", label: "Collections" },
  { value: "recruitment", label: "Recruitment" },
];

const KIND_TONE = { open: "neutral", won: "success", lost: "danger" } as const;

export default function PipelinesClient() {
  const { data: pipelines, isLoading, mutate } = useSWR<PipelineRow[]>("/api/pipelines");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [slaDraft, setSlaDraft] = useState<Record<string, string>>({});
  const [newStage, setNewStage] = useState<Record<string, { name: string; slaHours: string }>>({});
  const confirm = useConfirm();
  const prompt = usePrompt();
  const toast = useToast();

  const byDept = new Map((pipelines ?? []).map((p) => [p.department, p]));

  async function createPipeline(department: Department) {
    setMsg(null);
    try {
      await api("/api/pipelines", { method: "POST", body: { department } });
      await mutate();
      toast("Pipeline created.");
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  async function setAssignmentRule(pipeline: PipelineRow, assignmentRule: AssignmentRule) {
    setMsg(null);
    try {
      await api("/api/pipelines", { method: "PATCH", body: { pipelineId: pipeline.id, assignmentRule } });
      await mutate();
      toast("Auto-assignment updated.");
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  async function renameStage(stage: Stage) {
    const name = await prompt({ title: "Rename stage", label: "Stage name", defaultValue: stage.name, confirmLabel: "Rename" });
    if (!name || name === stage.name) return;
    await patchStage(stage.id, { name });
  }

  async function patchStage(stageId: string, data: Partial<Pick<Stage, "name" | "kind" | "slaHours" | "position">>) {
    setMsg(null);
    try {
      await api("/api/pipeline-stages", { method: "PATCH", body: { stageId, ...data } });
      await mutate();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  async function saveSla(stage: Stage) {
    const raw = slaDraft[stage.id];
    if (raw === undefined) return;
    const slaHours = raw.trim() === "" ? null : Number(raw);
    if (slaHours !== null && (!Number.isFinite(slaHours) || slaHours <= 0)) {
      setMsg({ kind: "error", text: "SLA hours must be a positive number." });
      return;
    }
    await patchStage(stage.id, { slaHours });
    setSlaDraft((d) => {
      const next = { ...d };
      delete next[stage.id];
      return next;
    });
    toast("Saved.");
  }

  async function moveStage(pipeline: PipelineRow, stage: Stage, dir: -1 | 1) {
    const idx = pipeline.stages.findIndex((s) => s.id === stage.id);
    const target = idx + dir;
    if (target < 0 || target >= pipeline.stages.length) return;
    await patchStage(stage.id, { position: target });
  }

  async function removeStage(pipeline: PipelineRow, stage: Stage) {
    const proceed = await confirm({
      title: `Delete "${stage.name}"?`,
      body: "Only possible while this stage has no contacts in it.",
      confirmLabel: "Delete stage",
      tone: "danger",
    });
    if (!proceed) return;
    setMsg(null);
    try {
      await api("/api/pipeline-stages", { method: "DELETE", body: { stageId: stage.id } });
      await mutate();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  async function addStage(pipeline: PipelineRow) {
    const draft = newStage[pipeline.id] ?? { name: "", slaHours: "" };
    if (!draft.name.trim()) return;
    const slaHours = draft.slaHours.trim() === "" ? null : Number(draft.slaHours);
    if (slaHours !== null && (!Number.isFinite(slaHours) || slaHours <= 0)) {
      setMsg({ kind: "error", text: "SLA hours must be a positive number." });
      return;
    }
    setMsg(null);
    try {
      await api("/api/pipeline-stages", { method: "POST", body: { pipelineId: pipeline.id, name: draft.name.trim(), slaHours } });
      setNewStage((d) => ({ ...d, [pipeline.id]: { name: "", slaHours: "" } }));
      await mutate();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    }
  }

  return (
    <>
      <DashHeader
        title="Pipelines"
        subtitle="One set of mechanics, configured per department — stages, order, and SLA hours."
      />

      <div className="mx-auto max-w-3xl space-y-6 p-8">
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

        {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}

        {!isLoading &&
          DEPARTMENTS.map(({ value, label }) => {
            const pipeline = byDept.get(value);

            if (!pipeline) {
              return (
                <EmptyState
                  key={value}
                  icon={GitBranch}
                  title={`${label} has no pipeline yet`}
                  body={`Create it from the built-in ${label.toLowerCase()} template, then edit its stages below.`}
                  action={
                    <button onClick={() => createPipeline(value)} className="btn btn-primary !px-4 !py-2 text-sm">
                      Create {label.toLowerCase()} pipeline
                    </button>
                  }
                />
              );
            }

            const draft = newStage[pipeline.id] ?? { name: "", slaHours: "" };

            return (
              <Panel key={pipeline.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-bold">{pipeline.name}</h2>
                    {pipeline.isDefault && <Badge tone="accent">Default</Badge>}
                    <span className="text-xs text-ink-soft">{pipeline._count.items} in pipeline</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label>Auto-assign new contacts</Label>
                    <Select
                      value={pipeline.assignmentRule}
                      onChange={(e) => setAssignmentRule(pipeline, e.target.value as AssignmentRule)}
                      className="w-56 !py-1.5 text-xs"
                    >
                      {ASSIGNMENT_RULES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="divide-y divide-line">
                  {pipeline.stages.map((stage, i) => {
                    const sla = slaDraft[stage.id];
                    const dirty = sla !== undefined && sla !== (stage.slaHours?.toString() ?? "");
                    return (
                      <div key={stage.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="flex shrink-0 flex-col">
                          <button
                            onClick={() => moveStage(pipeline, stage, -1)}
                            disabled={i === 0}
                            className="rounded p-0.5 text-ink-faint hover:bg-tint hover:text-ink disabled:opacity-30"
                            title="Move earlier"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveStage(pipeline, stage, 1)}
                            disabled={i === pipeline.stages.length - 1}
                            className="rounded p-0.5 text-ink-faint hover:bg-tint hover:text-ink disabled:opacity-30"
                            title="Move later"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex min-w-[10rem] flex-1 items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{stage.name}</span>
                          <button
                            onClick={() => renameStage(stage)}
                            className="rounded p-1 text-ink-soft hover:bg-tint hover:text-ink"
                            title="Rename"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>

                        <Select
                          value={stage.kind}
                          onChange={(e) => patchStage(stage.id, { kind: e.target.value as StageKind })}
                          className="w-24 !py-1.5 text-xs"
                        >
                          <option value="open">Open</option>
                          <option value="won">Won</option>
                          <option value="lost">Lost</option>
                        </Select>
                        <Badge tone={KIND_TONE[stage.kind]} className="hidden sm:inline-flex">{stage.kind}</Badge>

                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                          <Input
                            type="number"
                            min={1}
                            placeholder="No SLA"
                            value={sla ?? stage.slaHours?.toString() ?? ""}
                            onChange={(e) => setSlaDraft((d) => ({ ...d, [stage.id]: e.target.value }))}
                            className="!w-20 !py-1.5 text-xs"
                          />
                          <span className="text-xs text-ink-faint">h</span>
                        </div>
                        {dirty && (
                          <button onClick={() => saveSla(stage)} className="btn btn-primary !px-3 !py-1.5 text-xs">
                            Save
                          </button>
                        )}

                        <button
                          onClick={() => removeStage(pipeline, stage)}
                          className="ml-auto rounded-lg p-1.5 text-ink-soft hover:bg-tint hover:text-danger"
                          title="Delete stage"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-line p-3">
                  <div className="min-w-[10rem] flex-1">
                    <Label>New stage name</Label>
                    <Input
                      value={draft.name}
                      onChange={(e) => setNewStage((d) => ({ ...d, [pipeline.id]: { ...draft, name: e.target.value } }))}
                      placeholder="e.g. Demo scheduled"
                      className="!py-2 text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <Label>SLA (h)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={draft.slaHours}
                      onChange={(e) => setNewStage((d) => ({ ...d, [pipeline.id]: { ...draft, slaHours: e.target.value } }))}
                      placeholder="Optional"
                      className="!py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => addStage(pipeline)}
                    disabled={!draft.name.trim()}
                    className={cn("btn btn-ghost !px-4 !py-2 text-sm", !draft.name.trim() && "opacity-50")}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add stage
                  </button>
                </div>
              </Panel>
            );
          })}
      </div>
    </>
  );
}
