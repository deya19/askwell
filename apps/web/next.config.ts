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

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@askwell/shared"],
  async headers() {
    return FRAME_HEADERS;
  },
};

export default nextConfig;
