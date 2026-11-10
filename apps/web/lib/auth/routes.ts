/**
 * Which paths need a signed-in owner (project.md §6.2, §8).
 *
 * The proxy uses this for an early check: signed-out page visits go to /sign-in,
 * signed-out owner API calls get a 401. Each protected page and route handler
 * still checks the session itself (`auth.protect()` / `requireOwner()`), because
 * path matching alone can miss a request Next.js routes differently.
 */

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const AFTER_AUTH_PATH = "/dashboard";
export const AFTER_SIGN_OUT_PATH = SIGN_IN_PATH;

/** Owner pages. Signed out → redirect to sign-in. */
const PROTECTED_PAGE_PREFIXES = ["/dashboard"] as const;

/** Owner API routes. Signed out → 401 JSON. */
const PROTECTED_API_PREFIXES = ["/api/projects", "/api/knowledge", "/api/conversations"] as const;

export type RouteAccess = "public" | "owner-page" | "owner-api";

/** True for `prefix` itself and anything under it (`/dashboard`, `/dashboard/x`), not `/dashboardx`. */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function routeAccess(pathname: string): RouteAccess {
  if (PROTECTED_API_PREFIXES.some((p) => isUnder(pathname, p))) return "owner-api";
  if (PROTECTED_PAGE_PREFIXES.some((p) => isUnder(pathname, p))) return "owner-page";
  return "public";
}
