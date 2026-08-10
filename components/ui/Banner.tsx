"use client";

import React from "react";
import { cn } from "@/lib/cn";

const KINDS = {
  error: "border-danger/30 bg-danger-soft text-danger-strong",
  success: "border-success/30 bg-success-soft text-success-strong",
  info: "border-line bg-tint text-ink",
} as const;

export function Banner({
  kind,
  children,
  className,
}: {
  kind: keyof typeof KINDS;
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", KINDS[kind], className)}>{children}</div>;
}
