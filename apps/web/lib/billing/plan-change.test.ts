import type { WebhookEvent } from "@clerk/nextjs/webhooks";
import { describe, expect, it } from "vitest";
import { planCheckUserFor, planFromSubscription, type SubscriptionItemState } from "./plan-change";
import { subscriptionItemEvent } from "./test-helpers";

const event = (...args: Parameters<typeof subscriptionItemEvent>) =>
  subscriptionItemEvent(...args) as unknown as WebhookEvent;

describe("planCheckUserFor", () => {
  it.each([
    "subscriptionItem.active",
    "subscriptionItem.ended",
    "subscriptionItem.canceled",
    "subscriptionItem.updated",
    "subscriptionItem.pastDue",
    "subscriptionItem.upcoming",
  ])("%s → the payer's user ID (a trigger only)", (type) => {
    expect(planCheckUserFor(event(type))).toBe("user_payer");
  });

  it("any plan's item is a trigger (a plan switch can end one item and start Pro)", () => {
    expect(planCheckUserFor(event("subscriptionItem.ended", { slug: "free_user" }))).toBe("user_payer");
  });

  it("ignores an organization payer and a payload with no payer user", () => {
    expect(planCheckUserFor(event("subscriptionItem.active", { userId: undefined, organizationId: "org_1" }))).toBeNull();
    expect(planCheckUserFor(event("subscriptionItem.active", { userId: undefined }))).toBeNull();
  });

  it("ignores other event types", () => {
    expect(planCheckUserFor({ type: "user.created", data: { id: "user_1" } } as unknown as WebhookEvent)).toBeNull();
    expect(
      planCheckUserFor({ type: "subscription.active", data: { payer: { user_id: "user_1" } } } as unknown as WebhookEvent),
    ).toBeNull();
  });
});

describe("planFromSubscription", () => {
  const NOW = 1_800_000_000_000;
  const item = (status: string, slug = "pro", periodEnd: number | null = NOW + 1000): SubscriptionItemState => ({
    status,
    plan: { slug },
    periodEnd,
  });

  it.each(["active", "past_due"])("a Pro item %s → pro", (status) => {
    expect(planFromSubscription([item(status)], NOW)).toBe("pro");
  });

  it("a canceled Pro item → pro until the period ends, then free", () => {
    expect(planFromSubscription([item("canceled", "pro", NOW + 1)], NOW)).toBe("pro");
    expect(planFromSubscription([item("canceled", "pro", NOW)], NOW)).toBe("free");
    expect(planFromSubscription([item("canceled", "pro", null)], NOW)).toBe("free");
  });

  it.each(["ended", "upcoming", "expired", "abandoned", "incomplete"])("a Pro item %s → free", (status) => {
    expect(planFromSubscription([item(status)], NOW)).toBe("free");
  });

  it("only the Pro plan's items count", () => {
    expect(planFromSubscription([item("active", "free_user")], NOW)).toBe("free");
    expect(planFromSubscription([{ status: "active", plan: null, periodEnd: null }], NOW)).toBe("free");
  });

  it("no items → free; an ended item next to an active Pro item → pro", () => {
    expect(planFromSubscription([], NOW)).toBe("free");
    expect(planFromSubscription([item("ended", "pro", NOW - 1), item("active")], NOW)).toBe("pro");
  });
});
