"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Reloads the page's server data. Manual only: no polling, no realtime (project.md §6.7). */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-live="polite"
    >
      <svg viewBox="0 0 24 24" className={pending ? "size-4 animate-spin" : "size-4"} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
