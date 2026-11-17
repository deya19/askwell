"use client";

import { PricingTable } from "@clerk/nextjs";
import { Skeleton } from "@/components/dashboard/states";
import { AFTER_CHECKOUT_URL } from "./billing-state";

/**
 * Clerk's pricing table (project.md §6.10). Picking Pro opens Clerk's checkout drawer.
 * After paying, "Continue" brings the owner back to Billing with the checkout flag,
 * where the page waits for the webhook to set the plan.
 */
export function Upgrade() {
  return (
    <section aria-labelledby="upgrade" className="mt-10">
      <h2 id="upgrade" className="text-lg font-semibold tracking-tight">
        Upgrade
      </h2>
      <p className="mt-1 text-sm text-pretty text-muted">
        More projects, more messages, and a widget that matches your brand.
      </p>
      <div className="mt-6 min-w-0">
        <PricingTable newSubscriptionRedirectUrl={AFTER_CHECKOUT_URL} fallback={<PricingSkeleton />} />
      </div>
    </section>
  );
}

function PricingSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2">
      <span className="sr-only">Loading plans…</span>
      <Skeleton className="h-72" />
      <Skeleton className="h-72" />
    </div>
  );
}
