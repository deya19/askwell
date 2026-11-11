import { Skeleton } from "@/components/dashboard/states";
import { GlassPanel } from "@/components/ui/glass-panel";

/** The Install page while the project loads. */
export default function InstallLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-20" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <GlassPanel strong className="mt-8 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-16 rounded-pill" />
        </div>
        <div className="p-4 sm:p-5">
          <Skeleton className="h-5 w-full" />
        </div>
      </GlassPanel>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
