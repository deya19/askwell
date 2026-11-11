"use client";

import { useEffect } from "react";
import { AlertIcon, StatePanel } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";

/** Shown inside the dashboard shell when a page fails to render. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatePanel
      role="alert"
      icon={<AlertIcon />}
      title="Something went wrong"
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    >
      This page couldn&apos;t load. Try again, and if it keeps happening, reload the page.
      {error.digest && <span className="mt-2 block font-mono text-xs">Error ID: {error.digest}</span>}
    </StatePanel>
  );
}
