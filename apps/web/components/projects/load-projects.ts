import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Plan, Project } from "@askwell/shared";
import { getOwnerPlan } from "@/lib/projects/plan";
import { toProject } from "@/lib/projects/project";
import { createOwnerClient } from "@/lib/supabase/owner";

export type ProjectsPageData = { plan: Plan; projects: Project[] };

/**
 * The owner's plan and projects, newest first, for the projects page.
 *
 * Everything goes through the owner client, so RLS scopes it to the caller.
 * `messagesUsed` comes from `owner_activity()`, which shows 0 once the
 * monthly period has rolled over, even before the next message resets the
 * stored count. Throws on any database error; the page's error.tsx shows it.
 */
export async function loadProjectsPage(): Promise<ProjectsPageData> {
  const { userId } = await auth.protect();
  const supabase = await createOwnerClient();

  const [plan, projectsResult, activityResult] = await Promise.all([
    getOwnerPlan(supabase, userId),
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.rpc("owner_activity"),
  ]);

  if (projectsResult.error) throw new Error(`Could not list projects: ${projectsResult.error.message}`);
  if (activityResult.error) throw new Error(`Could not load usage: ${activityResult.error.message}`);

  const usage = new Map(activityResult.data.map((row) => [row.project_id, row.messages_used]));
  const projects = projectsResult.data.map((row) => {
    const project = toProject(row);
    return { ...project, messagesUsed: usage.get(project.id) ?? project.messagesUsed };
  });

  // The dashboard layout creates the account row before any page renders, so a
  // missing row here is a race with a deletion. Show the Free limits, never more.
  return { plan: plan ?? "free", projects };
}
