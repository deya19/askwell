import type { WebhookEvent } from "@clerk/nextjs/webhooks";
import { describe, expect, it } from "vitest";
import { planChangeFor } from "./plan-change";
import { subscriptionItemEvent } from "./test-helpers";

const event = (...args: Parameters<typeof subscriptionItemEvent>) =>
  subscriptionItemEvent(...args) as unknown as WebhookEvent;

describe("planChangeFor", () => {
  it("Pro item active → pro for the payer", () => {
    expect(planChangeFor(event("subscriptionItem.active"))).toEqual({ userId: "user_payer", plan: "pro" });
  });

  it("Pro item ended → free", () => {
    expect(planChangeFor(event("subscriptionItem.ended"))).toEqual({ userId: "user_payer", plan: "free" });
  });

  it.each(["subscriptionItem.canceled", "subscriptionItem.updated", "subscriptionItem.pastDue", "subscriptionItem.upcoming"])(
    "%s alone changes nothing (Pro stays until the item ends)",
    (type) => {
      expect(planChangeFor(event(type))).toBeNull();
    },
  );

  it.each(["subscriptionItem.active", "subscriptionItem.ended"])("ignores another plan's %s", (type) => {
    expect(planChangeFor(event(type, { slug: "free_user" }))).toBeNull();
  });

  it("ignores an organization payer and a payload with no payer user", () => {
    expect(planChangeFor(event("subscriptionItem.active", { userId: undefined, organizationId: "org_1" }))).toBeNull();
    expect(planChangeFor(event("subscriptionItem.active", { userId: undefined }))).toBeNull();
  });

  it("ignores other event types", () => {
    expect(planChangeFor({ type: "user.created", data: { id: "user_1" } } as unknown as WebhookEvent)).toBeNull();
    expect(
      planChangeFor({ type: "subscription.active", data: { items: [{ plan: { slug: "pro" } }] } } as unknown as WebhookEvent),
    ).toBeNull();
  });
});
