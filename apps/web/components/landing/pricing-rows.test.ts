import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "@askwell/shared";
import { pricingRows } from "./pricing-rows";

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
