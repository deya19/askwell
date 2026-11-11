import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";
import type { Database } from "./types";

export type OwnerClient = SupabaseClient<Database>;

/**
 * Supabase client for the signed-in owner, for server components and route handlers.
 *
 * It uses the publishable key and sends the owner's Clerk session token on every
 * request (Supabase third-party auth), so RLS scopes every read to the owner's rows.
 * Signed out, `getToken()` is null and requests run as `anon`, which may read nothing.
 *
 * Create one per request: the token belongs to the current request's session.
 */
export async function createOwnerClient(): Promise<OwnerClient> {
  const { getToken } = await auth();
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      accessToken: async () => (await getToken()) ?? null,
    },
  );
}
