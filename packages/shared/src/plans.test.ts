import { describe, expect, test } from "vitest";
import { PLAN_LIMITS, PLANS } from "./plans";

describe("PLAN_LIMITS", () => {
  test("Free matches project.md §5", () => {
    expect(PLAN_LIMITS.free).toEqual({
      projects: 1,
      messagesPerMonth: 100,
      knowledgeSources: 3,
      customize: false,
      showBadge: true,
    });
  });

  test("Pro matches project.md §5", () => {
    expect(PLAN_LIMITS.pro).toEqual({
      projects: 5,
      messagesPerMonth: 2000,
      knowledgeSources: 25,
      customize: true,
      showBadge: false,
    });
  });

  test("covers every plan and nothing else", () => {
    expect(Object.keys(PLAN_LIMITS).sort()).toEqual([...PLANS].sort());
  });
});
