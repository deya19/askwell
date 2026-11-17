import "server-only";
import { auth } from "@clerk/nextjs/server";
import { PLAN_LIMITS, applyPlanToWidgetConfig, type Plan, type WidgetConfig } from "@askwell/shared";
import { getOwnerPlan } from "@/lib/projects/plan";
import { createOwnerClient } from "@/lib/supabase/owner";
import { getSavedWidgetConfig } from "@/lib/widget/update-config";

export type CustomizePageData = {
  plan: Plan;
  /** Whether the plan may save changes. Read on the server; the API checks it again. */
  canCustomize: boolean;
  /** What the widget shows today: the saved config on Pro, the defaults with the badge on Free. */
  config: WidgetConfig;
};

/**
 * The owner's plan and a project's widget config, both through the owner client (RLS).
 * The page checks the project with `getOwnedProject` first. Throws on a database error;
 * error.tsx shows it.
 */
export async function loadCustomizePage(projectId: string): Promise<CustomizePageData> {
  const { userId } = await auth.protect();
  const supabase = await createOwnerClient();

  const [plan, saved] = await Promise.all([getOwnerPlan(supabase, userId), getSavedWidgetConfig(supabase, projectId)]);

  // A missing account row is a race with a deletion: treat it as Free, never more.
  const effectivePlan = plan ?? "free";
  return {
    plan: effectivePlan,
    canCustomize: PLAN_LIMITS[effectivePlan].customize,
    config: applyPlanToWidgetConfig(effectivePlan, saved),
  };
}
