import { z } from "zod";

// System routes.

/**
 * `POST /api/clerk/webhook`: the fields we read from a Clerk Billing `subscriptionItem.*` event,
 * after `verifyWebhook()` has checked the signature. On these events `data` is the item itself.
 * Other events are ignored. Unknown fields are kept.
 */
export const clerkSubscriptionItemEventSchema = z.looseObject({
  type: z.string().startsWith("subscriptionItem."),
  data: z.looseObject({
    id: z.string(),
    status: z.string(),
    payer: z.looseObject({
      user_id: z.string().optional(),
      organization_id: z.string().optional(),
    }),
    plan: z.looseObject({ slug: z.string() }).optional(),
  }),
});
export type ClerkSubscriptionItemEvent = z.infer<typeof clerkSubscriptionItemEventSchema>;

/** `POST /api/clerk/webhook` response. */
export const clerkWebhookResponseSchema = z.object({ received: z.literal(true) });
export type ClerkWebhookResponse = z.infer<typeof clerkWebhookResponseSchema>;

/** `GET /api/posthog-config` response: PostHog's public project key and host. No secrets. */
export const posthogConfigResponseSchema = z.object({
  key: z.string().min(1),
  host: z.url(),
});
export type PosthogConfigResponse = z.infer<typeof posthogConfigResponseSchema>;
