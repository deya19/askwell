import type { NextConfig } from "next";

/** The chat panel the widget loads in an iframe. The only page other sites may frame. */
export const EMBED_PATH = "/embed";

type HeaderRoute = { source: string; headers: { key: string; value: string }[] };

/**
 * Clickjacking rules (project.md §9). `/embed` may be framed by any site; every other path
 * may only be framed by our own pages. The second source excludes exactly `/embed` (and
 * anything under it), so the two rules never both apply and never send conflicting headers.
 */
export const FRAME_HEADERS: HeaderRoute[] = [
  {
    source: EMBED_PATH,
    headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
  },
  {
    source: "/:path((?!embed(?:/|$)).*)",
    headers: [
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      // For old browsers without CSP frame-ancestors.
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ],
  },
];

/**
 * Sent on every path, `/embed` included (project.md §9). Different keys from FRAME_HEADERS,
 * so adding them can't conflict with the frame rules.
 *
 * Limit: these rules (and FRAME_HEADERS) apply to final responses. The trailing-slash 308
 * (`/embed/` → `/embed`, `/dashboard/` → `/dashboard`) is sent by the router before `headers()`
 * runs, so it carries none of them. It has no body to sniff or frame, and the response it
 * redirects to has the full set.
 */
export const COMMON_SECURITY_HEADERS: HeaderRoute = {
  source: "/:path*",
  headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ],
};

/** Every header rule `next.config` serves. */
export const SECURITY_HEADERS: HeaderRoute[] = [COMMON_SECURITY_HEADERS, ...FRAME_HEADERS];

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@askwell/shared"],
  async headers() {
    return SECURITY_HEADERS;
  },
};

export default nextConfig;
