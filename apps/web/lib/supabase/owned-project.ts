import "server-only";
import { createOwnerClient } from "./owner";
import type { Tables } from "./types";

export type OwnedProject = Tables<"projects">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads a project through the owner client. RLS only shows the owner's own
 * projects, so this returns null for a project that doesn't exist or isn't theirs.
 *
 * Routes call it before any service-client write on a project (project.md §9).
 * Throws on a database error, so a failure never reads as "not yours".
 */
export async function getOwnedProject(projectId: string): Promise<OwnedProject | null> {
  // Not a UUID: no project can match, and Postgres would reject the cast.
  if (!UUID.test(projectId)) return null;

  const supabase = await createOwnerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`Could not load project: ${error.message}`);
  return data;
}
