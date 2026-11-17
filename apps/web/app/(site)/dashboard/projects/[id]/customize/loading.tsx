import { Skeleton } from "@/components/dashboard/states";
import { GlassPanel } from "@/components/ui/glass-panel";

/** The Customize page while the config and plan load. */
export default function CustomizeLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-20" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[440px] rounded-lg sm:h-[520px] lg:order-last" />
        <GlassPanel className="space-y-6 p-4 sm:p-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-pill" />
            </div>
          ))}
          <Skeleton className="h-10 w-24 rounded-pill" />
        </GlassPanel>
      </div>
    </div>
  );
}
