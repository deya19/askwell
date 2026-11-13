import { Skeleton } from "@/components/dashboard/states";
import { GlassPanel } from "@/components/ui/glass-panel";

/** The Knowledge page while the sources load. */
export default function KnowledgeLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading knowledge…</span>
      <Skeleton className="h-4 w-20" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <GlassPanel strong className="mt-8 p-4 sm:p-5">
        <Skeleton className="h-8 w-56 rounded-pill" />
        <Skeleton className="mt-4 h-24 w-full" />
      </GlassPanel>
      <GlassPanel className="mt-6 divide-y divide-border overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-8 w-full rounded-pill sm:w-40" />
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}
