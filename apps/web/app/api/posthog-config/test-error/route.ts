// TEMPORARY (P4C-T03): proves server errors reach PostHog error tracking. Removed before the PR opens.
export const dynamic = "force-dynamic";

export function GET(): Response {
  throw new Error("P4C-T03 server test error");
}
