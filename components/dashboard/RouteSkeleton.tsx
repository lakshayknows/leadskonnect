import { Skeleton, LoadingRegion } from "@/components/ui";

/**
 * Route-level placeholder shown by each `loading.tsx` while a force-dynamic
 * page awaits Postgres. Holds the real page's shape — header bar, then content —
 * so the layout doesn't jump when data arrives, which also keeps the tour's
 * spotlight ring from chasing a moving target.
 */
export function RouteSkeleton({ variant = "cards" }: { variant?: "cards" | "table" | "split" }) {
  return (
    <>
      <LoadingRegion label="Loading page" />
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-8 py-6">
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>

      <div className="p-8">
        {variant === "table" && (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {Array.from({ length: 10 }).map((_, r) => (
              <div key={r} className="flex gap-4 border-b border-line px-4 py-3.5 last:border-0">
                {Array.from({ length: 5 }).map((__, c) => (
                  <Skeleton key={c} className={`h-3.5 flex-1 ${c === 0 ? "max-w-[26%]" : ""}`} />
                ))}
              </div>
            ))}
          </div>
        )}

        {variant === "cards" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-6">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="mt-4 h-5 w-32" />
                <Skeleton className="mt-2 h-3.5 w-full max-w-[70%]" />
              </div>
            ))}
          </div>
        )}

        {variant === "split" && (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <Skeleton className="h-5 w-40" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-1.5 h-10 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-line bg-surface p-6">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3.5 w-full max-w-[60%]" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
