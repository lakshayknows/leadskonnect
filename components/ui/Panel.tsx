"use client";

import React from "react";
import { cn } from "@/lib/cn";

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-line bg-surface p-6 shadow-sm", className)}>{children}</div>;
}
