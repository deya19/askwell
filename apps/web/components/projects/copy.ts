import { APP_NAME, PLAN_LIMITS, type Plan } from "@askwell/shared";

/** Where to send owners who hit the project limit, until billing ships (Phase 5). */
export const PRICING_PATH = "/#pricing";

const PLAN_NAMES: Record<Plan, string> = { free: "Free", pro: "Pro" };

function projects(count: number): string {
  return `${count} ${count === 1 ? "project" : "projects"}`;
}

/**
 * The inline message after `POST /api/projects` returns 402 `limit_reached`.
 * Limits come from `PLAN_LIMITS`, so this follows any change to the plans.
 */
export function limitReachedMessage(plan: Plan): string {
  const included = `The ${PLAN_NAMES[plan]} plan includes ${projects(PLAN_LIMITS[plan].projects)}.`;
  if (plan === "pro") return `${included} Delete one to add another.`;
  return `${included} ${APP_NAME} Pro allows up to ${projects(PLAN_LIMITS.pro.projects)}.`;
}

/** The delete dialog's check: the typed text must be the project's exact name. */
export function deleteConfirmMatches(typed: string, projectName: string): boolean {
  return projectName.length > 0 && typed === projectName;
}

/** "12 / 100 messages this month" for a project on the owner's plan. */
export function usageLabel(messagesUsed: number, plan: Plan): string {
  const limit = PLAN_LIMITS[plan].messagesPerMonth;
  return `${messagesUsed.toLocaleString("en-US")} / ${limit.toLocaleString("en-US")} messages this month`;
}

const createdFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Nov 11, 2026". Fixed locale and UTC, so the server and the browser render the same text. */
export function formatCreatedDate(createdAt: string): string {
  return createdFormat.format(new Date(createdAt));
}

/** The Install page for a project (built in P2P-T05). */
export function installPath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/install`;
}
