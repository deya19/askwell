import "server-only";
import arcjet, { shield } from "@arcjet/next";

/**
 * The shared Arcjet client: Shield on every protected route. Routes add their
 * own rules with `withRule()` so they share one decision cache.
 *
 * Server only. The only file that reads `ARCJET_KEY` (project.md §9).
 * Built on first use, so `next build` doesn't need the key.
 */
function createArcjet() {
  const key = process.env.ARCJET_KEY;
  if (!key) throw new Error("Missing environment variable ARCJET_KEY");
  return arcjet({ key, rules: [shield({ mode: "LIVE" })] });
}

let client: ReturnType<typeof createArcjet> | undefined;

export function getArcjet(): ReturnType<typeof createArcjet> {
  client ??= createArcjet();
  return client;
}
