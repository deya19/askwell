import { Skeleton } from "@/components/dashboard/states";
import { GlassPanel } from "@/components/ui/glass-panel";

/** The Conversations page while the list loads. */
export default function ConversationsLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading conversations…</span>
      <Skeleton className="h-4 w-20" />
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28 rounded-pill" />
      </div>
      <GlassPanel className="mt-8 divide-y divide-border overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <Skeleton className="h-5 w-72 max-w-full" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}
