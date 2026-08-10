"use client";

import React, { cloneElement, useState } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  type Placement,
} from "@floating-ui/react";

/**
 * Supplementary label on hover or keyboard focus. Never the only place a piece
 * of information appears — a tooltip is unreachable on touch, so anything
 * required to complete a task belongs in the visible UI.
 */
export function Tooltip({
  label,
  children,
  placement = "top",
  delay = 350,
}: {
  label: string;
  children: React.ReactElement;
  placement?: Placement;
  delay?: number;
}) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { move: false, delay: { open: delay, close: 0 } }),
    useFocus(context),
    useDismiss(context),
    useRole(context, { role: "tooltip" }),
  ]);

  return (
    <>
      {cloneElement(
        children,
        getReferenceProps({ ref: refs.setReference, ...(children.props as Record<string, unknown>) }),
      )}
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[60] max-w-xs rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-ink-invert shadow-md"
          >
            {label}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
