import { PLAN_LIMITS } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import {
  AFTER_CHECKOUT_URL,
  BILLING_PATH,
  billingView,
  cameFromCheckout,
  CHECKOUT_PARAM,
  planHighlights,
} from "./billing-state";

describe("billingView", () => {
  it("shows Free with the pricing table", () => {
    expect(billingView("free", false)).toBe("free");
  });

  it("waits for the webhook after checkout while the server still reads Free", () => {
    expect(billingView("free", true)).toBe("updating");
  });

  it("shows Pro only when the server reads Pro", () => {
    expect(billingView("pro", false)).toBe("pro");
    expect(billingView("pro", true)).toBe("pro");
  });
});

describe("cameFromCheckout", () => {
  it("is true when the checkout flag is in the URL", () => {
    expect(cameFromCheckout({ [CHECKOUT_PARAM]: "done" })).toBe(true);
    expect(cameFromCheckout({ [CHECKOUT_PARAM]: "" })).toBe(true);
    expect(cameFromCheckout({ [CHECKOUT_PARAM]: ["a", "b"] })).toBe(true);
  });

  it("is false without it", () => {
    expect(cameFromCheckout({})).toBe(false);
    expect(cameFromCheckout({ other: "1" })).toBe(false);
  });
});

describe("AFTER_CHECKOUT_URL", () => {
  it("returns to Billing with the checkout flag", () => {
    const url = new URL(AFTER_CHECKOUT_URL, "https://example.com");
    expect(url.pathname).toBe(BILLING_PATH);
    expect(cameFromCheckout(Object.fromEntries(url.searchParams))).toBe(true);
  });
});

describe("planHighlights", () => {
  it("lists the Free limits from PLAN_LIMITS", () => {
    expect(planHighlights("free")).toEqual([
      `${PLAN_LIMITS.free.projects} project`,
      `${PLAN_LIMITS.free.messagesPerMonth} messages a month per project`,
      `${PLAN_LIMITS.free.knowledgeSources} knowledge sources per project`,
      "Default widget look",
      "“Powered by” badge shown",
    ]);
  });

  it("lists the Pro limits from PLAN_LIMITS", () => {
    expect(planHighlights("pro")).toEqual([
      `${PLAN_LIMITS.pro.projects} projects`,
      `${PLAN_LIMITS.pro.messagesPerMonth.toLocaleString("en-US")} messages a month per project`,
      `${PLAN_LIMITS.pro.knowledgeSources} knowledge sources per project`,
      "Custom widget look",
      "No “Powered by” badge",
    ]);
  });
});
