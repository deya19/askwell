import type { Instrumentation } from "next";

export function register(): void {}

/**
 * Server errors (route handlers, server components, server actions) go to PostHog error
 * tracking (project.md §6.11). Linked to the visitor's browser session when its PostHog
 * cookie is present. Node runtime only: posthog-node doesn't run on the edge.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { captureServerException, getPostHogKey } = await import("./lib/analytics/server");
  const { distinctIdFromCookies } = await import("./lib/analytics/distinct-id");

  const key = getPostHogKey();
  if (!key) return;

  await captureServerException(error, distinctIdFromCookies(request.headers.cookie, key), {
    $current_url: request.path,
    method: request.method,
    router_kind: context.routerKind,
    route_path: context.routePath,
    route_type: context.routeType,
  });
};
