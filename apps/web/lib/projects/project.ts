import type { Project } from "@askwell/shared";
import type { Tables } from "../supabase/types";

export type ProjectRow = Tables<"projects">;

/** Maps a `projects` row to the `Project` the API and dashboard use. `owner_id` stays on the server. */
export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    publicKey: row.public_key,
    messagesUsed: row.messages_used,
    periodStart: row.period_start,
    createdAt: row.created_at,
  };
}
