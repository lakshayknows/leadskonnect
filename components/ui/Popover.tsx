"use client";

import React, { cloneElement, useState } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
  type Placement,
} from "@floating-ui/react";
import { cn } from "@/lib/cn";

/**
 * Anchored panel that escapes its container. Portalled to `document.body` and
 * positioned with `strategy: "fixed"`, because the sidebar it most often opens
 * from is a `sticky` element with an `overflow-y-auto` nav — an absolutely
 * positioned child would be clipped by both.
 */
export function Popover({
  trigger,
  children,
  placement = "bottom-end",
  className,
  open: controlledOpen,
  onOpenChange,
  matchTriggerWidth = false,
}: {
  /** Must forward props and a ref — pass a DOM element or a component that spreads them. */
  trigger: React.ReactElement;
  children: React.ReactNode | ((api: { close: () => void }) => React.ReactNode);
  placement?: Placement;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pin the panel to the trigger's width — for menus anchored to a full-width button. */
  matchTriggerWidth?: boolean;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (v: boolean) => {
    setUncontrolled(v);
    onOpenChange?.(v);
  };

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableHeight, elements, rects }) {
          // Cap to the space that actually exists so a long menu scrolls
          // inside itself instead of running off the viewport.
          elements.floating.style.maxHeight = `${Math.max(180, availableHeight)}px`;
          if (matchTriggerWidth) elements.floating.style.width = `${rects.reference.width}px`;
        },
      }),
    ],
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context, { outsidePress: true }),
    useRole(context, { role: "dialog" }),
  ]);

  return (
    <>
      {cloneElement(
        trigger,
        getReferenceProps({ ref: refs.setReference, ...(trigger.props as Record<string, unknown>) }),
      )}
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className={cn(
                "z-50 overflow-y-auto rounded-2xl border border-line bg-surface-raised p-2 shadow-[0_20px_50px_-24px_rgba(20,20,20,0.4)]",
                className,
              )}
            >
              {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
