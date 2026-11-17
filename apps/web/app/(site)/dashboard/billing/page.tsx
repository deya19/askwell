import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/states";
import { billingView, cameFromCheckout } from "@/components/billing/billing-state";
import { CurrentPlan } from "@/components/billing/current-plan";
import { loadBillingPlan } from "@/components/billing/load-billing";
import { ManageSubscription } from "@/components/billing/manage-subscription";
import { PlanUpdating } from "@/components/billing/plan-updating";
import { Upgrade } from "@/components/billing/upgrade";

export const metadata: Metadata = { title: "Billing" };

/**
 * The owner's plan and Clerk Billing (project.md §6.10). The plan is read on the
 * server from `accounts`, which only the Clerk webhook changes.
 */
export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const [plan, params] = await Promise.all([loadBillingPlan(), searchParams]);
  const view = billingView(plan, cameFromCheckout(params));

  return (
    <>
      <PageHeader title="Billing" description="Your plan and subscription." />
      {view === "updating" ? (
        <PlanUpdating />
      ) : (
        <CurrentPlan plan={plan} action={view === "pro" ? <ManageSubscription /> : undefined} />
      )}
      {view === "free" && <Upgrade />}
    </>
  );
}
