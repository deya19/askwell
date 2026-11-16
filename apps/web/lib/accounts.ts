import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Plan } from "@askwell/shared";
import { captureServerEvent } from "./analytics/server";
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
 *
 * Sends `signed_up` (project.md §6.11) only when this call inserted the row, so once
 * per user. Analytics never throws, so it can't fail the account.
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

  const created = data.length > 0;
  if (created) await captureServerEvent({ event: "signed_up", distinctId: userId });
  return { userId, created };
}

export type SetAccountPlanResult = { changed: boolean };

/**
 * Sets an account's plan for the Clerk Billing webhook (project.md §6.10). Server only:
 * `userId` must come from a verified webhook payload. Creates the row if it doesn't exist.
 *
 * `changed` is true only when the plan was different before this call (a missing row counts
 * as Free), so a replayed event changes nothing and reports `changed: false`. Three steps,
 * each safe to race with `ensureAccount` or another delivery:
 * 1. update the row only if its plan differs;
 * 2. no row updated: insert it with the plan (`on conflict do nothing`);
 * 3. a conflict means another request just created the row: update it once more.
 *
 * Sends `upgraded` (project.md §6.11) once per actual free → pro change.
 */
export async function setAccountPlan(userId: string, plan: Plan): Promise<SetAccountPlanResult> {
  const changed = (await updatePlanIfDifferent(userId, plan)) || (await insertAccount(userId, plan));
  const result = changed ? true : await updatePlanIfDifferent(userId, plan);

  if (result && plan === "pro") await captureServerEvent({ event: "upgraded", distinctId: userId });
  return { changed: result };
}

/** True if the row existed with another plan and now has `plan`. */
async function updatePlanIfDifferent(userId: string, plan: Plan): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("accounts")
    .update({ plan })
    .eq("clerk_user_id", userId)
    .neq("plan", plan)
    .select("clerk_user_id");
  if (error) throw new Error(`Could not update plan: ${error.message}`);
  return data.length > 0;
}

/**
 * True if this inserted the row with `plan`. A new row on Free isn't a change (that's
 * the default); a new row on Pro is a free → pro change.
 */
async function insertAccount(userId: string, plan: Plan): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("accounts")
    .upsert({ clerk_user_id: userId, plan }, { onConflict: "clerk_user_id", ignoreDuplicates: true })
    .select("clerk_user_id");
  if (error) throw new Error(`Could not create account: ${error.message}`);
  return data.length > 0 && plan !== NEW_ACCOUNT_PLAN;
}
