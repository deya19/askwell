"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BillingIcon, StatePanel } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { PLAN_REFRESH_ATTEMPTS, PLAN_REFRESH_INTERVAL_MS } from "./billing-state";

/**
 * Shown after Clerk's checkout while `accounts.plan` is still Free. The plan only
 * changes when Clerk's webhook arrives (a few seconds), so this re-reads the page
 * from the server a few times. It never decides the plan itself: once the server
 * reads Pro, the page renders the Pro view.
 */
export function PlanUpdating() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [refreshing, startRefresh] = useTransition();
  const waiting = attempts < PLAN_REFRESH_ATTEMPTS;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      startRefresh(() => router.refresh());
      setAttempts((n) => n + 1);
    }, PLAN_REFRESH_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [attempts, waiting, router]);

  return (
    <StatePanel
      role="status"
      icon={<BillingIcon />}
      title={waiting ? "Updating your plan…" : "Still updating your plan"}
      action={
        <Button variant="secondary" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      }
    >
      {waiting
        ? "Thanks for upgrading. Your payment went through, and Pro will show here in a few seconds."
        : "This is taking longer than usual. Your payment went through. Refresh in a minute to see Pro."}
    </StatePanel>
  );
}
