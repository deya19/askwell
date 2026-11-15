import { idParamsSchema } from "@askwell/shared";
import { requireOwner } from "../../../../../lib/auth/require-owner";
import { listConversations } from "../../../../../lib/conversations/queries";
import { noStoreError, noStoreErrorResponse, noStoreJson } from "../../../../../lib/conversations/http";
import { internalErrorResponse } from "../../../../../lib/projects/http";
import { getOwnedProject } from "../../../../../lib/supabase/owned-project";

type Context = { params: Promise<{ id: string }> };

/**
 * `GET /api/projects/:id/conversations`: the project's newest 100 conversations, newest
 * first, with a preview and message count. 404 for a bad id, a missing project and someone
 * else's project alike (project.md §9).
 */
export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return noStoreError(owner.response);

    const parsed = idParamsSchema.safeParse(await context.params);
    const project = parsed.success ? await getOwnedProject(parsed.data.id) : null;
    if (!project) return noStoreErrorResponse("not_found", "Project not found.");

    return noStoreJson(await listConversations(project.id));
  } catch (cause) {
    return noStoreError(internalErrorResponse(cause));
  }
}
