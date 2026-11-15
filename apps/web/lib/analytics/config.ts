import { posthogConfigResponseSchema, type PosthogConfigResponse } from "@askwell/shared";

type Env = Record<string, string | undefined>;

/**
 * PostHog's public project key and host (project.md §11), or null when either is missing
 * or invalid. Both are public by design: they only let a client send events.
 *
 * Pass `process.env` itself. The names are read through the object at call time, so Next.js
 * never inlines them at build time and a promoted build uses its own environment's project.
 */
export function readPostHogConfig(env: Env): PosthogConfigResponse | null {
  const parsed = posthogConfigResponseSchema.safeParse({
    key: env["NEXT_PUBLIC_POSTHOG_KEY"]?.trim(),
    host: env["NEXT_PUBLIC_POSTHOG_HOST"]?.trim().replace(/\/+$/, ""),
  });
  return parsed.success ? parsed.data : null;
}
