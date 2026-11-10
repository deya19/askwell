import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";
import type { Database } from "./types";

export type ServiceClient = SupabaseClient<Database>;

/**
 * Supabase client with the secret key. It acts as `service_role` and skips RLS.
 *
 * Server only. The only file that reads `SUPABASE_SECRET_KEY` (project.md §9).
 * Use it only after the route has checked ownership (`getOwnedProject`) and plan,
 * never for owner reads with a manual owner filter.
 */
export function createServiceClient(): ServiceClient {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
