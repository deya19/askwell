import { PLAN_LIMITS, type Plan } from "@askwell/shared";

/** The Billing page's path. Clerk's checkout sends the owner back here. */
export const BILLING_PATH = "/dashboard/billing";

/** Added to the Billing URL by Clerk's checkout "Continue" button, so the page knows a payment just finished. */
export const CHECKOUT_PARAM = "checkout";

/** Where Clerk's checkout sends the owner after paying. */
export const AFTER_CHECKOUT_URL = `${BILLING_PATH}?${CHECKOUT_PARAM}=done`;

/** How often the "Updating your plan…" state re-reads the plan from the server, and how many times. */
export const PLAN_REFRESH_INTERVAL_MS = 3_000;
export const PLAN_REFRESH_ATTEMPTS = 10;

/**
 * What the Billing page shows.
 * - `free`: the plan and Clerk's pricing table.
 * - `updating`: the owner just paid, but the webhook hasn't set Pro yet.
 * - `pro`: the plan and "Manage subscription".
 *
 * `plan` is always the one read on the server from `accounts`. The checkout flag only
 * changes the copy while we wait; it never makes the page show Pro.
 */
export type BillingView = "free" | "updating" | "pro";

export function billingView(plan: Plan, justCheckedOut: boolean): BillingView {
  if (plan === "pro") return "pro";
  return justCheckedOut ? "updating" : "free";
}

/** True when the URL's search params say Clerk's checkout just sent the owner back. */
export function cameFromCheckout(searchParams: Record<string, string | string[] | undefined>): boolean {
  return searchParams[CHECKOUT_PARAM] !== undefined;
}

export const PLAN_NAMES: Record<Plan, string> = { free: "Free", pro: "Pro" };

function count(value: number, one: string, many: string): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`;
}

/** The plan's limits as short lines, from `PLAN_LIMITS` so they follow any change to the plans. */
export function planHighlights(plan: Plan): string[] {
  const limits = PLAN_LIMITS[plan];
  return [
    count(limits.projects, "project", "projects"),
    `${count(limits.messagesPerMonth, "message", "messages")} a month per project`,
    `${count(limits.knowledgeSources, "knowledge source", "knowledge sources")} per project`,
    limits.customize ? "Custom widget look" : "Default widget look",
    limits.showBadge ? "“Powered by” badge shown" : "No “Powered by” badge",
  ];
}
