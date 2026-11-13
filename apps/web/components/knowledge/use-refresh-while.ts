"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

/** How often the list refetches while a source is processing. */
export const POLL_INTERVAL_MS = 3000;

/**
 * Refetches the page's server data every few seconds while `active` is true, so a source
 * moves from Processing to Ready without a manual reload. Skips ticks while the tab is
 * hidden, and stops as soon as nothing is processing.
 */
export function useRefreshWhile(active: boolean, intervalMs = POLL_INTERVAL_MS) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      startTransition(() => router.refresh());
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs, router]);
}
