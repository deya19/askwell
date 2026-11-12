import { Skeleton } from "@/components/dashboard/states";
import { GlassPanel } from "@/components/ui/glass-panel";

/** Shown inside the dashboard shell while a page loads. */
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-pill sm:w-36" />
      </div>
      <GlassPanel className="mt-8 flex flex-col items-center px-6 py-14 sm:py-20">
        <Skeleton className="size-12" />
        <Skeleton className="mt-5 h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </GlassPanel>
    </div>
  );
}
