import { APP_NAME, PLAN_LIMITS, apiError, okResponseSchema } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { readApiResponse } from "./api";
import { deleteConfirmMatches, formatCreatedDate, installPath, limitReachedMessage, usageLabel } from "./copy";

describe("deleteConfirmMatches", () => {
  it("matches only the exact name", () => {
    expect(deleteConfirmMatches("Docs site", "Docs site")).toBe(true);
    expect(deleteConfirmMatches("docs site", "Docs site")).toBe(false);
    expect(deleteConfirmMatches("Docs site ", "Docs site")).toBe(false);
    expect(deleteConfirmMatches("Docs", "Docs site")).toBe(false);
    expect(deleteConfirmMatches("", "Docs site")).toBe(false);
  });

  it("matches names with markup as plain text", () => {
    expect(deleteConfirmMatches("<b>x</b>", "<b>x</b>")).toBe(true);
  });

  it("never matches an empty name", () => {
    expect(deleteConfirmMatches("", "")).toBe(false);
  });
});

describe("limitReachedMessage", () => {
  it("states the Free limit and what Pro allows, from PLAN_LIMITS", () => {
    const free = PLAN_LIMITS.free.projects;
    const pro = PLAN_LIMITS.pro.projects;
    expect(limitReachedMessage("free")).toBe(
      `The Free plan includes ${free} project${free === 1 ? "" : "s"}. ${APP_NAME} Pro allows up to ${pro} projects.`,
    );
  });

  it("tells Pro owners to delete one", () => {
    expect(limitReachedMessage("pro")).toBe(
      `The Pro plan includes ${PLAN_LIMITS.pro.projects} projects. Delete one to add another.`,
    );
  });
});

describe("usageLabel", () => {
  it("shows used / the plan's monthly limit", () => {
    expect(usageLabel(12, "free")).toBe(`12 / ${PLAN_LIMITS.free.messagesPerMonth} messages this month`);
    expect(usageLabel(1500, "pro")).toBe("1,500 / 2,000 messages this month");
  });
});

describe("formatCreatedDate", () => {
  it("formats in UTC", () => {
    expect(formatCreatedDate("2026-11-02T23:30:00.123456+00:00")).toBe("Nov 2, 2026");
    expect(formatCreatedDate("2026-11-03T01:00:00+02:00")).toBe("Nov 2, 2026");
  });
});

describe("installPath", () => {
  it("points at the project's Install page", () => {
    expect(installPath("6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f")).toBe(
      "/dashboard/projects/6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f/install",
    );
  });
});

describe("readApiResponse", () => {
  it("returns the parsed body on success", async () => {
    const result = await readApiResponse(Response.json({ ok: true }), okResponseSchema);
    expect(result).toEqual({ ok: true, data: { ok: true } });
  });

  it("returns the API error code and message", async () => {
    const response = Response.json(apiError("limit_reached", "Limit."), { status: 402 });
    expect(await readApiResponse(response, okResponseSchema)).toEqual({
      ok: false,
      code: "limit_reached",
      message: "Limit.",
    });
  });

  it("falls back to a generic error for a body that isn't an API error", async () => {
    const response = new Response("<html>502</html>", { status: 502 });
    const result = await readApiResponse(response, okResponseSchema);
    expect(result).toMatchObject({ ok: false, code: "internal_error" });
  });

  it("treats a 2xx with the wrong shape as an error", async () => {
    const result = await readApiResponse(Response.json({ nope: 1 }), okResponseSchema);
    expect(result).toMatchObject({ ok: false, code: "internal_error" });
  });
});
