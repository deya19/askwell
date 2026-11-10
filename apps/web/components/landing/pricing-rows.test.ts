import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "@askwell/shared";
import { formatPrice, PLAN_PRICES_USD, pricingRows } from "./pricing-rows";

describe("pricingRows", () => {
  it("matches the plan table in project.md §5", () => {
    expect(pricingRows(PLAN_LIMITS)).toEqual([
      { label: "Projects", free: "1", pro: "5" },
      { label: "Messages / month (per project)", free: "100", pro: "2,000" },
      { label: "Knowledge sources (per project)", free: "3", pro: "25" },
      { label: "Button color", free: "Default", pro: "Any" },
      { label: "Button position", free: "Bottom right", pro: "Any corner" },
      { label: "Button label", free: "Default", pro: "Custom" },
      { label: "Open animation", free: "Fade", pro: "Fade / slide / scale" },
      { label: "Header text", free: "Default", pro: "Custom" },
      { label: '"Powered by" badge', free: "Shown", pro: "Hidden" },
    ]);
  });

  it("follows the limits it is given", () => {
    const rows = pricingRows({
      free: { ...PLAN_LIMITS.free, messagesPerMonth: 12345 },
      pro: { ...PLAN_LIMITS.pro, customize: false, showBadge: true },
    });
    expect(rows[1]?.free).toBe("12,345");
    expect(rows[3]?.pro).toBe("Default");
    expect(rows[8]?.pro).toBe("Shown");
  });
});

describe("plan prices", () => {
  it("is $0 for Free and $19 for Pro (PO decision)", () => {
    expect(PLAN_PRICES_USD).toEqual({ free: 0, pro: 19 });
    expect(formatPrice(PLAN_PRICES_USD.free)).toBe("$0");
    expect(formatPrice(PLAN_PRICES_USD.pro)).toBe("$19");
  });

  it("shows cents only when there are some", () => {
    expect(formatPrice(9.5)).toBe("$9.50");
  });
});
