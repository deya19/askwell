import { posthogConfigResponseSchema } from "@askwell/shared";
import type { PostHog } from "posthog-js";

/** Browser-side PostHog. Only the site loads it (landing, auth pages, dashboard), never /embed. */

let instance: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

/** The initialized client, or null before init, without a key, or on pages that don't load it. */
export function getLoadedPostHog(): PostHog | null {
  return instance;
}

async function load(): Promise<PostHog | null> {
  const response = await fetch("/api/posthog-config", { cache: "no-store" });
  if (!response.ok) return null; // 404 = not configured on this deployment.
  const config = posthogConfigResponseSchema.safeParse(await response.json());
  if (!config.success) return null;

  // Imported here, not at the top, so the SDK is its own chunk fetched only by pages that init it.
  const { default: posthog } = await import("posthog-js");
  posthog.init(config.data.key, {
    api_host: config.data.host,
    defaults: "2026-08-30",
    person_profiles: "identified_only",
    // Errors: uncaught errors, unhandled rejections, and console.error, which is how the
    // dashboard's error boundaries (error.tsx) report what they catch.
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: true,
    },
    // Replay starts off; PostHogAnalytics turns it on for the landing page and the dashboard.
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
      // Anything marked `ph-no-capture` (chat text on the Conversations pages) is blocked.
      blockClass: "ph-no-capture",
    },
  });
  instance = posthog;
  return posthog;
}

/** Fetches the config and inits PostHog once. Resolves to null when it can't (and never rejects). */
export function loadPostHog(): Promise<PostHog | null> {
  loading ??= load().catch((error: unknown) => {
    console.warn("[analytics] PostHog didn't load", error);
    return null;
  });
  return loading;
}
