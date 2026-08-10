"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Variants map onto the `.btn` classes already in globals.css, so
 * `<Button variant="primary">` renders exactly what the existing
 * `className="btn btn-primary"` call sites render.
 */
const VARIANTS = {
  primary: "btn btn-primary",
  ghost: "btn btn-ghost",
  /** Quiet in-panel action — no pill, no lift. */
  subtle: "inline-flex items-center gap-2 rounded-xl px-3 py-2 font-semibold text-ink-soft transition-colors hover:bg-tint hover:text-ink",
  // Hover shifts opacity rather than swapping to a "darker" shade: the danger
  // ramp inverts between themes, so `danger-strong` is lighter in dark mode.
  danger: "inline-flex items-center gap-2 rounded-full bg-danger px-5 py-2.5 font-semibold text-on-solid transition-opacity hover:opacity-90",
} as const;

const SIZES = {
  sm: "!px-3.5 !py-2 text-sm",
  md: "",
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Shows a spinner and blocks interaction without collapsing the button's width. */
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        VARIANTS[variant],
        SIZES[size],
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0",
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
