import { describe, expect, test, vi } from "vitest";

// The proxy's runtime imports aren't needed to read its `config`.
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: () => () => undefined }));
vi.mock("@/lib/auth/routes", () => ({ routeAccess: () => "public", SIGN_IN_PATH: "/sign-in", SIGN_UP_PATH: "/sign-up" }));
vi.mock("@/lib/auth/unauthorized", () => ({ unauthorizedResponse: () => undefined }));

const { config } = await import("../../proxy");

// Compile the matcher the way `next build` does, so this checks real matching.
// Next exports this function but doesn't type it.
type CompiledMatcher = { regexp: string };
const { getMiddlewareMatchers } = (await import("next/dist/build/analysis/get-page-static-info")) as unknown as {
  getMiddlewareMatchers: (matcher: string[], nextConfig: object) => CompiledMatcher[];
};
const matchers = getMiddlewareMatchers(config.matcher, {}).map((m) => new RegExp(m.regexp));
const runsOn = (path: string) => matchers.some((re) => re.test(path));

describe("proxy matcher", () => {
  test.each(["/embed", "/embed/"])("skips %s (cross-site iframe, no auth)", (path) => {
    expect(runsOn(path)).toBe(false);
  });

  test.each(["/", "/dashboard", "/dashboard/projects", "/sign-in", "/embedded", "/x/embed", "/api/widget/config", "/api/projects"])(
    "runs on %s",
    (path) => {
      expect(runsOn(path)).toBe(true);
    },
  );
});
