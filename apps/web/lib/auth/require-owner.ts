import "server-only";
import { auth } from "@clerk/nextjs/server";
import { unauthorizedResponse } from "./unauthorized";

export type OwnerCheck = { ok: true; userId: string } | { ok: false; response: Response };

/**
 * Call at the top of every owner route handler. The proxy already blocks
 * signed-out calls, but each handler checks again (Clerk's resource-based rule).
 *
 *   const owner = await requireOwner();
 *   if (!owner.ok) return owner.response;
 */
export async function requireOwner(): Promise<OwnerCheck> {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated) return { ok: false, response: unauthorizedResponse() };
  return { ok: true, userId };
}
