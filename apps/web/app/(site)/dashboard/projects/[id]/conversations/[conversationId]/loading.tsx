import { Skeleton } from "@/components/dashboard/states";
import { GlassPanel } from "@/components/ui/glass-panel";

/** A thread while it loads. */
export default function ConversationLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading conversation…</span>
      <Skeleton className="h-4 w-28" />
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 rounded-pill" />
      </div>
      <GlassPanel className="mt-8 flex flex-col gap-4 p-4 sm:p-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={i % 2 ? "flex flex-col items-end gap-1" : "flex flex-col items-start gap-1"}>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-64 max-w-[85%]" />
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}
