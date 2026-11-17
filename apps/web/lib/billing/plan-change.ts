import type { Plan } from "@askwell/shared";
import type { WebhookEvent } from "@clerk/nextjs/webhooks";

/** The Pro plan's slug in Clerk Billing (Dashboard → Billing → Plans). Must match exactly. */
export const PRO_PLAN_SLUG = "pro";

/**
 * The parts of Clerk's `BillingSubscriptionItem` (from `clerkClient.billing.getUserBillingSubscription`)
 * that decide the plan. `periodEnd` is a Unix timestamp in milliseconds.
 */
export type SubscriptionItemState = {
  status: string;
  plan: { slug: string } | null;
  periodEnd: number | null;
};

/**
 * The user whose plan a verified Clerk webhook event may have changed, or null for "change
 * nothing". Any `subscriptionItem.*` event for a user payer is only a trigger: the route then
 * reads the user's current subscription from Clerk ({@link planFromSubscription}). The event's
 * own status is never used, so the order Clerk delivers events in doesn't matter.
 *
 * Other event types and organization payers (no `user_id`) change nothing.
 */
export function planCheckUserFor(event: WebhookEvent): string | null {
  if (!event.type.startsWith("subscriptionItem.")) return null;
  const data = event.data as { payer?: { user_id?: string | null } | null };
  return data.payer?.user_id || null;
}

/**
 * The plan a user's current Clerk subscription gives (project.md §6.10): `pro` while a Pro item
 * still gives access, otherwise `free`.
 *
 * - `active` → Pro.
 * - `past_due` → Pro for now (the payment is being retried).
 * - `canceled` → Pro until `periodEnd`: a cancellation keeps Pro until the paid period ends.
 * - `ended`, `upcoming`, `expired`, `abandoned`, `incomplete` → no Pro access.
 */
export function planFromSubscription(items: readonly SubscriptionItemState[], now = Date.now()): Plan {
  const hasPro = items.some((item) => item.plan?.slug === PRO_PLAN_SLUG && givesAccess(item, now));
  return hasPro ? "pro" : "free";
}

function givesAccess(item: SubscriptionItemState, now: number): boolean {
  if (item.status === "active" || item.status === "past_due") return true;
  if (item.status === "canceled") return item.periodEnd !== null && item.periodEnd > now;
  return false;
}
