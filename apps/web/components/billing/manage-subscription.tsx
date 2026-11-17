"use client";

import { SubscriptionDetailsButton } from "@clerk/nextjs/experimental";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Opens Clerk's subscription details drawer, where the owner can see the plan,
 * the next payment, and cancel (project.md §6.10). We don't build our own.
 *
 * A cancel keeps Pro until the paid period ends, so the plan we show doesn't change
 * then. We still re-read it from the server, in case the webhook already ran.
 */
export function ManageSubscription() {
  const router = useRouter();

  return (
    <SubscriptionDetailsButton onSubscriptionCancel={() => router.refresh()}>
      <Button variant="secondary" className="w-full sm:w-auto">
        Manage subscription
      </Button>
    </SubscriptionDetailsButton>
  );
}
