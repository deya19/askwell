import { buildCustomRoute } from "next/dist/lib/build-custom-route";
import { describe, expect, test } from "vitest";
import nextConfig, { FRAME_HEADERS } from "../../next.config";

// Compile the rules the way `next build` does, so this checks real route matching.
const routes = FRAME_HEADERS.map((route) => {
  const built = buildCustomRoute("header", route) as { regex: string };
  return { ...route, regex: new RegExp(built.regex) };
});

/** The headers Next sends for `path`. A later rule overrides an earlier one with the same key. */
function headersFor(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const route of routes) {
    if (!route.regex.test(path)) continue;
    for (const { key, value } of route.headers) out[key] = value;
  }
  return out;
}

describe("frame headers", () => {
  test("next.config serves FRAME_HEADERS", async () => {
    expect(await nextConfig.headers?.()).toBe(FRAME_HEADERS);
  });

  test.each(["/embed", "/embed/"])("%s may be framed by any site", (path) => {
    expect(headersFor(path)).toEqual({ "Content-Security-Policy": "frame-ancestors *" });
  });

  test.each(["/", "/dashboard", "/dashboard/projects/1", "/sign-in", "/api/projects", "/embedded", "/embedx", "/x/embed", "/widget.js"])(
    "%s may only be framed by our own pages",
    (path) => {
      expect(headersFor(path)).toEqual({
        "Content-Security-Policy": "frame-ancestors 'self'",
        "X-Frame-Options": "SAMEORIGIN",
      });
    },
  );
});
