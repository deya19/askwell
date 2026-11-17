import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Plan } from "@askwell/shared";
import { getOwnerPlan } from "@/lib/projects/plan";
import { createOwnerClient } from "@/lib/supabase/owner";

/**
 * The signed-in owner's plan for the Billing page, read from their `accounts` row
 * through the owner client (RLS scopes it). Never from Clerk's session or the client:
 * the webhook (project.md §6.10) is what sets the plan.
 *
 * Throws on a database error; the dashboard's error.tsx shows it.
 */
export async function loadBillingPlan(): Promise<Plan> {
  const { userId } = await auth.protect();
  const plan = await getOwnerPlan(await createOwnerClient(), userId);
  // The dashboard layout creates the row first, so a missing row is a race with a deletion. Show Free.
  return plan ?? "free";
}
