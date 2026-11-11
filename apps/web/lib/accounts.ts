import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Plan } from "@askwell/shared";
import { createServiceClient } from "./supabase/service";

/** Every new account starts on Free. Upgrades come from the Clerk webhook, never the client. */
const NEW_ACCOUNT_PLAN: Plan = "free";

export type EnsureAccountResult = { userId: string; created: boolean };

/**
 * Makes sure the signed-in Clerk user has an `accounts` row (project.md §6.2).
 *
 * Server only. The user ID comes from the Clerk session on the server and the
 * plan is fixed here, so nothing from the client reaches the row.
 *
 * Runs `insert … on conflict (clerk_user_id) do nothing`: one statement, so it's
 * idempotent and safe when several requests race. An existing row (and its plan)
 * is never touched. Owners can't insert accounts (RLS), so this uses the service
 * client, scoped to the session's own user ID.
 */
export async function ensureAccount(): Promise<EnsureAccountResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("ensureAccount needs a signed-in user.");

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("accounts")
    .upsert(
      { clerk_user_id: userId, plan: NEW_ACCOUNT_PLAN },
      { onConflict: "clerk_user_id", ignoreDuplicates: true },
    )
    // With ignoreDuplicates, only a newly inserted row comes back.
    .select("clerk_user_id");

  if (error) throw new Error(`Could not create account: ${error.message}`);
  return { userId, created: data.length > 0 };
}
