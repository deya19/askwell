import { Skeleton } from "@/components/dashboard/states";
import { GlassPanel } from "@/components/ui/glass-panel";

/** The Billing page while the plan loads: header, current plan, and the pricing table. */
export default function BillingLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading billing…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <GlassPanel className="mt-8 p-5 sm:p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-6 w-16" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-56 max-w-full" />
          ))}
        </div>
      </GlassPanel>
      <div className="mt-10 space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
