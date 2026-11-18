import { buildCustomRoute } from "next/dist/lib/build-custom-route";
import { describe, expect, test } from "vitest";
import nextConfig, { SECURITY_HEADERS } from "../../next.config";

// Compile the rules the way `next build` does, so this checks real route matching.
const routes = SECURITY_HEADERS.map((route) => {
  const built = buildCustomRoute("header", route) as { regex: string };
  return { ...route, regex: new RegExp(built.regex) };
});

/** Header names are case-insensitive (RFC 9110), so compare them lowercased. */
const lower = (headers: Record<string, string>) =>
  Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));

/** The headers Next sends for `path`, names lowercased. Throws if two matching rules set the same name. */
function headersFor(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const route of routes) {
    if (!route.regex.test(path)) continue;
    for (const { key, value } of route.headers) {
      const name = key.toLowerCase();
      if (name in out) throw new Error(`${path}: two rules set ${name}`);
      out[name] = value;
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
    expect(headersFor(path)).toEqual(lower({ ...COMMON, "Content-Security-Policy": "frame-ancestors *" }));
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
    expect(headersFor(path)).toEqual(
      lower({
        ...COMMON,
        "Content-Security-Policy": "frame-ancestors 'self'",
        "X-Frame-Options": "SAMEORIGIN",
      }),
    );
  });
});
