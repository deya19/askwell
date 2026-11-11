import { Skeleton } from "@/components/dashboard/states";
import { GlassPanel } from "@/components/ui/glass-panel";

/** The projects list while it loads: header and three placeholder rows. */
export default function ProjectsLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading projects…</span>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-pill sm:w-36" />
      </div>
      <GlassPanel className="mt-8 divide-y divide-border overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-8 w-full rounded-pill sm:w-56" />
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}
