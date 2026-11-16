import type { Plan } from "@askwell/shared";
import type { WebhookEvent } from "@clerk/nextjs/webhooks";

/** The Pro plan's slug in Clerk Billing (Dashboard → Billing → Plans). Must match exactly. */
export const PRO_PLAN_SLUG = "pro";

export type PlanChange = { userId: string; plan: Plan };

/**
 * What a verified Clerk webhook event means for `accounts.plan` (project.md §6.10), or null
 * for "change nothing".
 *
 * - The Pro item becomes active → `pro`.
 * - The Pro item ends → `free`. A cancellation (`subscriptionItem.canceled`) keeps Pro until
 *   the paid period ends, when Clerk sends `subscriptionItem.ended`, so it changes nothing.
 * - Other plans' items (e.g. the default free plan), other event types, and organization
 *   payers change nothing.
 */
export function planChangeFor(event: WebhookEvent): PlanChange | null {
  if (event.type !== "subscriptionItem.active" && event.type !== "subscriptionItem.ended") return null;
  if (event.data.plan?.slug !== PRO_PLAN_SLUG) return null;

  // User plans only: an organization payer has no user_id.
  const userId = event.data.payer?.user_id;
  if (!userId) return null;

  return { userId, plan: event.type === "subscriptionItem.active" ? "pro" : "free" };
}
