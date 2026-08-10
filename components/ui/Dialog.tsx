"use client";

import React, { useCallback, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Modal built on the native `<dialog>` element.
 *
 * `showModal()` puts the dialog in the browser's top layer, which gives us the
 * focus trap, Escape handling, and inerting of the rest of the document for
 * free — and, because the top layer sits outside every stacking context, it
 * cannot be clipped or out-ranked by an ancestor's `transform` /
 * `backdrop-filter` (which `.glass` creates).
 *
 * The element's own open/close state is the browser's, not React's, so the two
 * are reconciled deliberately: an effect drives the element from the `open`
 * prop, and the `cancel`/`close` events drive React back. Skipping either half
 * is how `<dialog>` and React desync — Escape closes the element while React
 * still believes it is open, and it can never be reopened.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "sm",
  /** Set false for destructive confirms, where a stray backdrop click shouldn't dismiss. */
  dismissOnBackdrop = true,
  /**
   * Set false when the caller supplies its own header/body/footer structure.
   * The dialog still provides the top layer, focus trap and Escape handling;
   * `title` becomes the accessible name instead of a rendered heading.
   */
  chrome = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZES;
  dismissOnBackdrop?: boolean;
  chrome?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  // React state -> element state.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Element state -> React state. `cancel` fires on Escape; preventing it keeps
  // the single close path below rather than letting the browser close silently.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onCloseEvent = () => onClose();
    el.addEventListener("cancel", onCancel);
    el.addEventListener("close", onCloseEvent);
    return () => {
      el.removeEventListener("cancel", onCancel);
      el.removeEventListener("close", onCloseEvent);
    };
  }, [onClose]);

  // showModal() inerts the page but does not stop it scrolling behind the dialog.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Clicks on the backdrop are retargeted to the dialog itself. The inner
  // wrapper carries all the padding so this can never fire from inside.
  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (dismissOnBackdrop && e.target === ref.current) onClose();
    },
    [dismissOnBackdrop, onClose],
  );

  return (
    <dialog
      ref={ref}
      onClick={onClick}
      aria-label={chrome ? undefined : title}
      aria-labelledby={chrome ? titleId : undefined}
      aria-describedby={chrome && description ? descId : undefined}
      className={cn(
        "ft-dialog w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface-raised p-0 text-ink shadow-xl",
        SIZES[size],
        className,
      )}
    >
      {!chrome ? (
        children
      ) : (
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-bold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-ink-soft">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1.5 shrink-0 rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-tint hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children && <div className="mt-5">{children}</div>}
        {footer && <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{footer}</div>}
      </div>
      )}
    </dialog>
  );
}
