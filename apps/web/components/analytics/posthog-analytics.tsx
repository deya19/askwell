"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import type { PostHog } from "posthog-js";
import { useEffect, useState } from "react";
import { loadPostHog } from "@/lib/analytics/client";
import { isReplayPath } from "@/lib/analytics/replay";

/**
 * Loads PostHog for the site (landing, auth pages, dashboard): pageviews, errors, session
 * replay on the landing page and dashboard, and the signed-in owner's identity.
 * Rendered only by app/(site)/layout.tsx, so /embed never loads it. Renders nothing.
 */
export function PostHogAnalytics() {
  const [posthog, setPosthog] = useState<PostHog | null>(null);
  const pathname = usePathname();
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    let active = true;
    void loadPostHog().then((client) => {
      if (active) setPosthog(client);
    });
    return () => {
      active = false;
    };
  }, []);

  // Record the landing page and the dashboard only.
  useEffect(() => {
    if (!posthog) return;
    if (isReplayPath(pathname)) posthog.startSessionRecording();
    else posthog.stopSessionRecording();
  }, [posthog, pathname]);

  // Identify the owner by Clerk user ID; forget them on sign-out.
  useEffect(() => {
    if (!posthog || !isLoaded) return;
    if (userId) {
      if (posthog.get_distinct_id() !== userId) posthog.identify(userId);
    } else if (posthog.get_property("$user_state") === "identified") {
      posthog.reset();
    }
  }, [posthog, isLoaded, userId]);

  return null;
}
