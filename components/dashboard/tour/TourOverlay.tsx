"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  arrow,
  type Placement,
} from "@floating-ui/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTour } from "./TourProvider";

const PAD = 6;

/**
 * The spotlight is ONE fixed element whose box-shadow paints both the scrim and
 * the ring:
 *
 *   box-shadow: 0 0 0 100vmax var(--scrim), 0 0 0 2px var(--accent)
 *
 * so top/left/width/height/radius are a single interpolable set and moving
 * between steps is one CSS transition that cannot desync. Four dim panels would
 * seam mid-transition and couldn't round the hole; an SVG mask would mean two
 * coordinate systems to keep in step.
 *
 * The usual objection — that a box-shadow isn't hit-testable, so clicks leak
 * into the dimmed area — doesn't apply here, because `showModal()` makes the
 * rest of the document inert.
 */
export function TourOverlay() {
  const { status, index, steps, step, target, next, back, skip } = useTour();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [radius, setRadius] = useState("12px");

  const open = status !== "off";

  const { refs, floatingStyles, middlewareData, placement, update } = useFloating({
    placement: (step?.placement ?? "right") as Placement,
    strategy: "fixed",
    middleware: [
      offset(14),
      flip({ fallbackPlacements: ["right", "bottom", "top", "left"], padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableWidth, elements }) {
          elements.floating.style.maxWidth = `${Math.min(360, Math.max(260, availableWidth))}px`;
        },
      }),
      arrow({ element: arrowRef }),
    ],
  });

  // Drive the native dialog from React, and React back from the dialog.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    // Escape fires `cancel`; prevent it so closing always goes through skip()
    // and React never believes the tour is still running.
    const onCancel = (e: Event) => {
      e.preventDefault();
      skip();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [skip]);

  // Track the target. A virtual reference whose `contextElement` is the real
  // node lets Floating UI find every scroll ancestor — including the sidebar's
  // inner `overflow-y-auto` nav.
  useLayoutEffect(() => {
    if (!target) {
      refs.setReference(null);
      if (ringRef.current) ringRef.current.style.opacity = "0";
      return;
    }

    setRadius(getComputedStyle(target).borderRadius || "12px");

    const virtual = {
      getBoundingClientRect: () => {
        const r = target.getBoundingClientRect();
        return {
          x: r.x - PAD,
          y: r.y - PAD,
          top: r.top - PAD,
          left: r.left - PAD,
          right: r.right + PAD,
          bottom: r.bottom + PAD,
          width: r.width + PAD * 2,
          height: r.height + PAD * 2,
        } as DOMRect;
      },
      contextElement: target,
    };
    refs.setReference(virtual);

    // One pass writes both the callout position and the ring geometry, so they
    // can never disagree about where the target is.
    const paint = () => {
      const r = virtual.getBoundingClientRect();
      const ring = ringRef.current;
      if (ring) {
        ring.style.opacity = "1";
        ring.style.top = `${r.top}px`;
        ring.style.left = `${r.left}px`;
        ring.style.width = `${r.width}px`;
        ring.style.height = `${r.height}px`;
      }
      update();
    };

    const cleanup = autoUpdate(virtual, refs.floating.current ?? document.body, paint, {
      ancestorScroll: true,
      ancestorResize: true,
      elementResize: true,
      layoutShift: true,
      animationFrame: true,
    });
    paint();
    return cleanup;
  }, [target, refs, update]);

  // Move focus to the new step's heading; the dialog itself stays mounted so
  // the open animation doesn't replay and showModal() isn't re-run.
  useEffect(() => {
    if (status === "active") headingRef.current?.focus();
  }, [status, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, next, back]);

  if (!open || !step) return null;

  const isLast = index === steps.length - 1;
  const arrowX = middlewareData.arrow?.x;
  const arrowY = middlewareData.arrow?.y;
  const side = placement.split("-")[0] as "top" | "right" | "bottom" | "left";
  const opposite = { top: "bottom", right: "left", bottom: "top", left: "right" }[side];

  return (
    <>
      {/* Ring + scrim. Outside the dialog so it isn't clipped by it, and
          pointer-events:none so it never eats a click. */}
      <div
        ref={ringRef}
        aria-hidden
        className="ft-tour-ring"
        style={{ borderRadius: radius, opacity: 0 }}
      />

      <dialog ref={dialogRef} className="ft-tour-dialog" aria-label="Product tour">
        <div
          ref={refs.setFloating}
          style={target ? floatingStyles : undefined}
          className={
            target
              ? "w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface-raised p-5 text-ink shadow-xl"
              : "fixed left-1/2 top-1/2 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface-raised p-5 text-ink shadow-xl"
          }
        >
          {target && (
            <div
              ref={arrowRef}
              aria-hidden
              className="absolute h-2.5 w-2.5 rotate-45 border-b border-r border-line bg-surface-raised"
              style={{
                left: arrowX != null ? `${arrowX}px` : "",
                top: arrowY != null ? `${arrowY}px` : "",
                [opposite]: "-5px",
                borderBottomWidth: side === "top" ? 1 : 0,
                borderRightWidth: side === "left" ? 1 : 0,
                borderTopWidth: side === "bottom" ? 1 : 0,
                borderLeftWidth: side === "right" ? 1 : 0,
              }}
            />
          )}

          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-base font-bold outline-none"
          >
            {step.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.body}</p>

          {/* Status only — focus movement already announces the step content. */}
          <span aria-live="polite" className="sr-only">
            {status === "navigating" ? "Loading the next step" : `Step ${index + 1} of ${steps.length}`}
          </span>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center gap-1.5" aria-hidden>
              {steps.map((s, i) => (
                <span
                  key={s.target}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-4 bg-accent" : "w-1.5 bg-line-strong"
                  }`}
                />
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={back}
                disabled={index === 0}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-tint hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                onClick={next}
                className="flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-ink-invert transition-opacity hover:opacity-90"
              >
                {isLast ? "Done" : "Next"}
                {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <button
            onClick={skip}
            className="mt-3 w-full rounded-lg py-1.5 text-xs font-medium text-ink-faint transition-colors hover:text-ink-soft"
          >
            Skip the tour
          </button>
        </div>
      </dialog>
    </>
  );
}
