import { describe, expect, it } from "vitest";
import { routeAccess } from "./routes";

describe("routeAccess", () => {
  it.each([
    "/",
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-up",
    "/sign-up/verify-email-address",
    "/embed",
    "/embed/abc",
    "/api/widget/config",
    "/api/widget/chat",
    "/api/clerk/webhook",
    "/api/posthog-config",
  ])("%s is public", (path) => {
    expect(routeAccess(path)).toBe("public");
  });

  it.each(["/dashboard", "/dashboard/", "/dashboard/projects/123", "/dashboard/billing"])(
    "%s is an owner page",
    (path) => {
      expect(routeAccess(path)).toBe("owner-page");
    },
  );

  it.each([
    "/api/projects",
    "/api/projects/abc",
    "/api/projects/abc/knowledge",
    "/api/projects/abc/knowledge/upload-url",
    "/api/projects/abc/config",
    "/api/projects/abc/conversations",
    "/api/knowledge/abc",
    "/api/conversations/abc",
  ])("%s is an owner API route", (path) => {
    expect(routeAccess(path)).toBe("owner-api");
  });

  it("matches whole path segments only", () => {
    expect(routeAccess("/dashboardx")).toBe("public");
    expect(routeAccess("/api/projectsx")).toBe("public");
    expect(routeAccess("/api/widget/projects")).toBe("public");
  });
});
