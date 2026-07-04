"use client";

import React from "react";

export function DashHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-8 py-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}

export function Banner({ kind, children }: { kind: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles =
    kind === "error"
      ? "border-red-300 bg-red-50 text-red-700"
      : kind === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : "border-line bg-tint text-ink";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ink ${props.className ?? ""}`}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block font-mono text-xs uppercase tracking-wide text-ink-soft">{children}</label>;
}
