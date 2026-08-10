"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PRODUCT_TOUR, type TourStep } from "./steps";
import { tourSelector } from "./target";
import type { OnboardingState } from "@/lib/queries";

/** The dashboard is unusable below this width, so the tour doesn't run there. */
const MIN_WIDTH = 1024;
const TARGET_TIMEOUT_MS = 5000;

export type TourStatus = "off" | "navigating" | "active" | "paused";

type TourApi = {
  status: TourStatus;
  index: number;
  steps: TourStep[];
  step: TourStep | null;
  target: HTMLElement | null;
  next: () => void;
  back: () => void;
  skip: () => void;
  finish: () => void;
  start: (from?: number) => void;
  resume: () => void;
};

const Ctx = createContext<TourApi | null>(null);

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function patch(body: Record<string, unknown>) {
  return fetch("/api/onboarding", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/**
 * Waits for a target to exist AND have a box. During hydration or a Suspense
 * swap the node can be in the DOM at zero size, which would spotlight nothing.
 */
function waitForTarget(id: TourStep["target"], signal: AbortSignal): Promise<HTMLElement | null> {
  const sel = tourSelector(id);

  const find = () => {
    const all = document.querySelectorAll<HTMLElement>(sel);
    if (process.env.NODE_ENV !== "production" && all.length > 1) {
      console.error(`[tour] ${all.length} elements match ${sel} — targets must be unique.`);
    }
    const el = all[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? el : null;
  };

  const immediate = find();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let done = false;
    const settle = (el: HTMLElement | null) => {
      if (done) return;
      done = true;
      obs.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      signal.removeEventListener("abort", onAbort);
      resolve(el);
    };
    const onAbort = () => settle(null);

    // MutationObserver catches insertion; the rAF tick catches the case where
    // the node already existed and only just gained a size.
    const obs = new MutationObserver(() => {
      const el = find();
      if (el) settle(el);
    });
    obs.observe(document.body, { childList: true, subtree: true });

    let raf = 0;
    const tick = () => {
      const el = find();
      if (el) return settle(el);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Generous: every dashboard page is force-dynamic and awaits Postgres, so
    // a cold start plus a large query can genuinely take seconds.
    const timer = setTimeout(() => settle(null), TARGET_TIMEOUT_MS);
    signal.addEventListener("abort", onAbort);
  });
}

/** Resolve once the element's rect stops moving, so the ring doesn't chase a smooth scroll. */
function settleRect(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    let last = "";
    let stable = 0;
    let frames = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const key = `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)}`;
      stable = key === last ? stable + 1 : 0;
      last = key;
      if (stable >= 2 || ++frames > 30) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function TourProvider({
  initial,
  children,
}: {
  initial: OnboardingState | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const steps = PRODUCT_TOUR;

  // Lazy initialiser, NOT an effect: on a genuine first login the overlay is
  // present in the very first client paint, and for everyone else it never
  // renders at all — not even for one frame. An effect would flash it.
  const [status, setStatus] = useState<TourStatus>(() => {
    if (typeof window === "undefined") return "off";
    if (window.innerWidth < MIN_WIDTH) return "off";
    if (!initial) return "off";
    const unseen = !initial.completedAt && !initial.skippedAt;
    return unseen ? "navigating" : "off";
  });

  const [index, setIndex] = useState(() => {
    if (!initial) return 0;
    return Math.min(initial.step ?? 0, PRODUCT_TOUR.length - 1);
  });
  const [target, setTarget] = useState<HTMLElement | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const step = status === "off" ? null : (steps[index] ?? null);

  const goToStep = useCallback(
    async (i: number, dir: 1 | -1) => {
      if (i < 0) return;
      if (i >= steps.length) return;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const s = steps[i];
      setIndex(i);
      setStatus("navigating");
      setTarget(null);

      if (s.path !== window.location.pathname) {
        startTransition(() => router.push(s.path));
      }

      const el = await waitForTarget(s.target, ac.signal);
      if (ac.signal.aborted) return;

      if (!el) {
        if (s.onMissing === "skip") return goToStep(i + dir, dir);
        // Default: keep the copy, drop the spotlight. Never dead-end.
        setTarget(null);
        setStatus("active");
        return;
      }

      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      await settleRect(el);
      if (ac.signal.aborted) return;

      setTarget(el);
      setStatus("active");
      patch({ action: "step", step: i });

      // Warm both neighbours so Back is as fast as Next.
      if (steps[i + 1]) router.prefetch(steps[i + 1].path);
      if (steps[i - 1]) router.prefetch(steps[i - 1].path);
    },
    [router, steps],
  );

  const next = useCallback(() => {
    if (index >= steps.length - 1) {
      setStatus("off");
      setTarget(null);
      patch({ action: "complete" });
      return;
    }
    goToStep(index + 1, 1);
  }, [index, steps.length, goToStep]);

  const back = useCallback(() => goToStep(index - 1, -1), [index, goToStep]);

  const skip = useCallback(() => {
    abortRef.current?.abort();
    setStatus("off");
    setTarget(null);
    // Persist before any exit animation, so a hard reload can't resurrect it.
    patch({ action: "skip" });
  }, []);

  const finish = useCallback(() => {
    abortRef.current?.abort();
    setStatus("off");
    setTarget(null);
    patch({ action: "complete" });
  }, []);

  const start = useCallback(
    (from = 0) => {
      if (window.innerWidth < MIN_WIDTH) return;
      patch({ action: "restart" });
      goToStep(from, 1);
    },
    [goToStep],
  );

  const resume = useCallback(() => goToStep(index, 1), [index, goToStep]);

  // Kick off the first step once mounted, for the autostart case.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    if (status !== "navigating") return;
    started.current = true;
    goToStep(index, 1);
  }, [status, index, goToStep]);

  // ?tour=product — support links, and how Playwright drives it.
  useEffect(() => {
    if (searchParams.get("tour") !== "product") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("tour");
    router.replace(url.pathname + url.search);
    started.current = true;
    start(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // If the user navigates away mid-tour, pause rather than yanking them back.
  useEffect(() => {
    if (status !== "active" || !step) return;
    if (pathname !== step.path) {
      setStatus("paused");
      setTarget(null);
    }
  }, [pathname, status, step]);

  const value = useMemo<TourApi>(
    () => ({ status, index, steps, step, target, next, back, skip, finish, start, resume }),
    [status, index, steps, step, target, next, back, skip, finish, start, resume],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTour() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}
