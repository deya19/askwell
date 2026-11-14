import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { KnowledgeSource, Plan } from "@askwell/shared";
import { toKnowledgeSource } from "@/lib/knowledge/source";
import { getOwnerPlan } from "@/lib/projects/plan";
import { createOwnerClient } from "@/lib/supabase/owner";

export type KnowledgePageData = { plan: Plan; sources: KnowledgeSource[] };

/**
 * The owner's plan and a project's knowledge sources, newest first. Through the owner
 * client, so RLS only shows sources in the caller's own projects. The page checks the
 * project with `getOwnedProject` first. Throws on a database error; error.tsx shows it.
 */
export async function loadKnowledgePage(projectId: string): Promise<KnowledgePageData> {
  const { userId } = await auth.protect();
  const supabase = await createOwnerClient();

  const [plan, sourcesResult] = await Promise.all([
    getOwnerPlan(supabase, userId),
    supabase
      .from("knowledge_sources")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);
  if (sourcesResult.error) throw new Error(`Could not list knowledge sources: ${sourcesResult.error.message}`);

  // A missing account row is a race with a deletion: show the Free limits, never more.
  return { plan: plan ?? "free", sources: sourcesResult.data.map(toKnowledgeSource) };
}
