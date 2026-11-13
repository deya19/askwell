import type { OkResponse } from "@askwell/shared";
import { requireOwner } from "../../../../lib/auth/require-owner";
import { idParam, sourceNotFound, type IdContext } from "../../../../lib/knowledge/routes";
import { KNOWLEDGE_BUCKET } from "../../../../lib/knowledge/source";
import { internalErrorResponse } from "../../../../lib/projects/http";
import { createOwnerClient } from "../../../../lib/supabase/owner";
import { createServiceClient } from "../../../../lib/supabase/service";

/**
 * `DELETE /api/knowledge/:id`: deletes a source, its file and (by cascade) its chunks.
 *
 * The source is loaded through the owner client first, so RLS proves it's in one of the
 * caller's projects (404 otherwise). Only then does the service client delete.
 */
export async function DELETE(_request: Request, context: IdContext): Promise<Response> {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return owner.response;

    const id = await idParam(context);
    if (!id) return sourceNotFound();

    const supabase = await createOwnerClient();
    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .select("id, project_id, storage_key")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Could not load source: ${error.message}`);
    if (!source) return sourceNotFound();

    const service = createServiceClient();
    if (source.storage_key) {
      const removed = await service.storage.from(KNOWLEDGE_BUCKET).remove([source.storage_key]);
      if (removed.error) throw new Error(`Could not delete file: ${removed.error.message}`);
    }

    const { error: deleteError } = await service
      .from("knowledge_sources")
      .delete()
      .eq("id", source.id)
      .eq("project_id", source.project_id);
    if (deleteError) throw new Error(`Could not delete source: ${deleteError.message}`);

    const body: OkResponse = { ok: true };
    return Response.json(body);
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}
