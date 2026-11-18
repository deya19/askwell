"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { PageHeader, AlertIcon, StatePanel } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";

/** Shown when the Billing page can't read the plan. */
export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <PageHeader title="Billing" description="Your plan and subscription." />
      <StatePanel
        role="alert"
        icon={<AlertIcon />}
        title="We couldn't load your plan"
        action={
          <Button
            variant="secondary"
            // Refetch the server data, then re-render the page.
            onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
          >
            Try again
          </Button>
        }
      >
        Something went wrong on our side. Try again, and if it keeps happening, reload the page.
        {error.digest && <span className="mt-2 block font-mono text-xs">Error ID: {error.digest}</span>}
      </StatePanel>
    </>
  );
}
