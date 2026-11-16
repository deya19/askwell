import { verifyWebhook, type WebhookEvent } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { setAccountPlan } from "../../../../lib/accounts";
import { planChangeFor } from "../../../../lib/billing/plan-change";
import { errorResponse, internalErrorResponse } from "../../../../lib/projects/http";

/**
 * `POST /api/clerk/webhook`: keeps `accounts.plan` in sync with Clerk Billing (project.md §6.10).
 *
 * Public (no session): the Svix signature, checked with `CLERK_WEBHOOK_SIGNING_SECRET`, is the
 * only check, and nothing but the verified payload is used. A bad or missing signature gets 400
 * and changes nothing. Events that change no plan get 200. A database error gets 500, so Clerk
 * retries; a retry is safe because `setAccountPlan` is idempotent.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let event: WebhookEvent;
  try {
    event = await verifyWebhook(request);
  } catch (cause) {
    console.error("[clerk webhook] Signature verification failed", cause);
    return errorResponse("invalid_request", "Webhook signature verification failed.");
  }

  const change = planChangeFor(event);
  if (!change) return Response.json({ received: true });

  try {
    await setAccountPlan(change.userId, change.plan);
    return Response.json({ received: true });
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}
