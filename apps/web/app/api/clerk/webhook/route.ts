import type { Plan } from "@askwell/shared";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook, type WebhookEvent } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { setAccountPlan } from "../../../../lib/accounts";
import { planCheckUserFor, planFromSubscription } from "../../../../lib/billing/plan-change";
import { errorResponse, internalErrorResponse } from "../../../../lib/projects/http";

/**
 * `POST /api/clerk/webhook`: keeps `accounts.plan` in sync with Clerk Billing (project.md §6.10).
 *
 * Public (no session): the Svix signature, checked with `CLERK_WEBHOOK_SIGNING_SECRET`, is the
 * only check. A bad or missing signature gets 400 and changes nothing.
 *
 * Fetch-on-notify: a `subscriptionItem.*` event for a user only says "this user's billing
 * changed". The route reads the user's current subscription from Clerk and writes the plan it
 * gives, so a late or replayed event can't overwrite a newer plan. Events that name no user get
 * 200. A Clerk or database error gets 500 and nothing is written, so Clerk retries; a retry is
 * safe because `setAccountPlan` is idempotent.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let event: WebhookEvent;
  try {
    event = await verifyWebhook(request);
  } catch (cause) {
    console.error("[clerk webhook] Signature verification failed", cause);
    return errorResponse("invalid_request", "Webhook signature verification failed.");
  }

  const userId = planCheckUserFor(event);
  if (!userId) return Response.json({ received: true });

  try {
    await setAccountPlan(userId, await currentPlan(userId));
    return Response.json({ received: true });
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}

/** The plan the user's subscription gives right now. A user with no subscription (404) is on Free. */
async function currentPlan(userId: string): Promise<Plan> {
  try {
    const subscription = await (await clerkClient()).billing.getUserBillingSubscription(userId);
    return planFromSubscription(subscription.subscriptionItems);
  } catch (cause) {
    if (isClerkAPIResponseError(cause) && cause.status === 404) return "free";
    throw cause;
  }
}
