/**
 * The landing page runs the app's own widget (project.md §2 steps 1–2, §6.1), installed
 * exactly like a customer's: `<app url>/widget.js` with `data-key`.
 *
 * `LANDING_WIDGET_KEY` differs per environment and can be set after a deploy, so it is
 * read per request, never at build time (§11).
 */

import "server-only";
import { isPublicKey } from "@askwell/shared";
import { headers } from "next/headers";
import { connection } from "next/server";
import { resolveAppUrl } from "../../lib/app-url";

type HeaderSource = { get(name: string): string | null };

export type LandingWidget = { src: string; publicKey: string };

/**
 * The widget to load, or null when the key is missing, empty or not a public key.
 * A bad key loads nothing rather than a script that would only warn in the console.
 */
export function landingWidgetFrom(
  env: { LANDING_WIDGET_KEY?: string; NEXT_PUBLIC_APP_URL?: string },
  requestHeaders: HeaderSource,
): LandingWidget | null {
  const publicKey = env.LANDING_WIDGET_KEY?.trim();
  if (!publicKey || !isPublicKey(publicKey)) return null;
  return { src: `${resolveAppUrl(env.NEXT_PUBLIC_APP_URL, requestHeaders)}/widget.js`, publicKey };
}

/** The landing widget for the current request. Opts the page out of static rendering. */
export async function getLandingWidget(): Promise<LandingWidget | null> {
  await connection();
  const { LANDING_WIDGET_KEY, NEXT_PUBLIC_APP_URL } = process.env;
  return landingWidgetFrom({ LANDING_WIDGET_KEY, NEXT_PUBLIC_APP_URL }, await headers());
}
