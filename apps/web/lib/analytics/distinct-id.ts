/**
 * The PostHog distinct ID from posthog-js's cookie (`ph_<key>_posthog`), or undefined.
 * Lets a server error link to the browser session that caused it.
 */
export function distinctIdFromCookies(cookieHeader: string | string[] | undefined, key: string): string | undefined {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  if (!header) return undefined;

  const name = `ph_${key}_posthog`;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    try {
      const value: unknown = JSON.parse(decodeURIComponent(part.slice(separator + 1).trim()));
      if (typeof value !== "object" || value === null || !("distinct_id" in value)) return undefined;
      const id = value.distinct_id;
      return typeof id === "string" && id.length > 0 ? id : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
