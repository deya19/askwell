import "server-only";
import { PLANS, type Plan } from "@askwell/shared";
import type { OwnerClient } from "../supabase/owner";

function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}

/**
 * The signed-in owner's plan, read from their `accounts` row (project.md §5, §9 Plan bypass).
 *
 * Uses the owner client, so RLS only shows the caller's own row. Returns null when the
 * row doesn't exist yet (the dashboard creates it on first sign-in). Throws on a database
 * error or an unknown plan, so a failure never reads as "no account" or "free".
 */
export async function getOwnerPlan(supabase: OwnerClient, userId: string): Promise<Plan | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("plan")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Could not load plan: ${error.message}`);
  if (!data) return null;
  if (!isPlan(data.plan)) throw new Error(`Unknown plan: ${data.plan}`);
  return data.plan;
}
