/**
 * Session replay records the landing page and the dashboard only (project.md §6.11).
 * Sign-in/up pages and everything else are not recorded. /embed never loads PostHog at all.
 */
export function isReplayPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}
