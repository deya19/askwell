import type { Metadata } from "next";
import { BillingIcon, PageHeader, StatePanel } from "@/components/dashboard/states";

export const metadata: Metadata = { title: "Billing" };

/** Placeholder. Plans and checkout come with Clerk Billing (project.md §6.10). */
export default function BillingPage() {
  return (
    <>
      <PageHeader title="Billing" description="Your plan, usage and invoices." />
      <StatePanel icon={<BillingIcon />} title="Nothing to show yet">
        Your plan and invoices will appear here once billing is set up.
      </StatePanel>
    </>
  );
}
