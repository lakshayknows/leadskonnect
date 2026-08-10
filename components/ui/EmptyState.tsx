"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * An empty screen is an invitation to act. Every use names what will appear
 * here, why it is worth having, and exactly one primary action.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  secondary,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="font-display mt-5 text-lg font-bold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{body}</p>
      {(action || secondary) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

/**
 * Search or filters returned nothing. Distinct from a first-use empty state:
 * the data exists, the query is what's wrong, so the action clears it.
 */
export function NoResults({ query, onClear }: { query?: string; onClear?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="text-sm text-ink-soft">
        {query ? <>No matches for &ldquo;{query}&rdquo;.</> : <>No matches for these filters.</>}
      </p>
      {onClear && (
        <button onClick={onClear} className="mt-3 text-sm font-semibold text-accent hover:text-accent-strong">
          Clear filters
        </button>
      )}
    </div>
  );
}
