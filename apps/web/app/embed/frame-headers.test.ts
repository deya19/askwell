import { buildCustomRoute } from "next/dist/lib/build-custom-route";
import { describe, expect, test } from "vitest";
import nextConfig, { SECURITY_HEADERS } from "../../next.config";

// Compile the rules the way `next build` does, so this checks real route matching.
const routes = SECURITY_HEADERS.map((route) => {
  const built = buildCustomRoute("header", route) as { regex: string };
  return { ...route, regex: new RegExp(built.regex) };
});

/** The headers Next sends for `path`. Throws if two matching rules set the same key. */
function headersFor(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const route of routes) {
    if (!route.regex.test(path)) continue;
    for (const { key, value } of route.headers) {
      if (key in out) throw new Error(`${path}: two rules set ${key}`);
      out[key] = value;
    }
  }
  return out;
}

const COMMON = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

describe("security headers", () => {
  test("next.config serves SECURITY_HEADERS", async () => {
    expect(await nextConfig.headers?.()).toBe(SECURITY_HEADERS);
  });

  test.each(["/embed", "/embed/"])("%s may be framed by any site", (path) => {
    expect(headersFor(path)).toEqual({ ...COMMON, "Content-Security-Policy": "frame-ancestors *" });
  });

  test.each([
    "/",
    "/dashboard",
    "/dashboard/projects/1",
    "/sign-in",
    "/api/projects",
    "/api/widget/chat",
    "/api/clerk/webhook",
    "/embedded",
    "/embedx",
    "/x/embed",
    "/widget.js",
  ])("%s may only be framed by our own pages", (path) => {
    expect(headersFor(path)).toEqual({
      ...COMMON,
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
    });
  });
});
