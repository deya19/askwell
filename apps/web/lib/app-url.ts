/**
 * The app's public origin, where `/widget.js` and `/embed` are served (project.md §11).
 *
 * `NEXT_PUBLIC_APP_URL` wins. When it isn't set (Vercel previews), the request's own
 * origin is used, so a preview's snippet points at that preview.
 */

import { headers } from "next/headers";

type HeaderSource = { get(name: string): string | null };

/** `https://example.com` from an absolute http(s) URL, or null. Drops any path and trailing slash. */
function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** The first value of a header that proxies may send as a comma-separated list. */
function first(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

/** The request's origin from its `x-forwarded-*` / `host` headers, or null if they don't form one. */
export function requestOrigin(headers: HeaderSource): string | null {
  const host = first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  // A bare host[:port] only: anything with a path, userinfo or spaces is rejected.
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return null;

  const forwardedProto = first(headers.get("x-forwarded-proto"));
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
        ? "http"
        : "https";
  return toOrigin(`${proto}://${host}`);
}

/**
 * The app URL: the configured value if it's a valid http(s) URL, else the request's origin.
 * Throws when neither is available, so a page never shows a snippet with a broken src.
 */
export function resolveAppUrl(configured: string | undefined, requestHeaders: HeaderSource): string {
  const url = toOrigin(configured) ?? requestOrigin(requestHeaders);
  if (!url) throw new Error("No app URL: set NEXT_PUBLIC_APP_URL or send a Host header.");
  return url;
}

/** The app URL for the current request. For server components and route handlers. */
export async function getAppUrl(): Promise<string> {
  return resolveAppUrl(process.env.NEXT_PUBLIC_APP_URL, await headers());
}
