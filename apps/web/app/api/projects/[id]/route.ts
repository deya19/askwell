import { idParamsSchema, updateProjectRequestSchema, type OkResponse, type ProjectResponse } from "@askwell/shared";
import { requireOwner } from "../../../../lib/auth/require-owner";
import { removeProjectFiles } from "../../../../lib/knowledge/project-files";
import { errorResponse, internalErrorResponse, invalidBodyMessage, readJson } from "../../../../lib/projects/http";
import { toProject } from "../../../../lib/projects/project";
import { createOwnerClient } from "../../../../lib/supabase/owner";
import { createServiceClient } from "../../../../lib/supabase/service";

type Context = { params: Promise<{ id: string }> };

/** Same answer for a bad id, a missing project and someone else's project (project.md §9). */
function notFound(): Response {
  return errorResponse("not_found", "Project not found.");
}

/** The id when it's a UUID. Anything else can't match a project. */
async function projectId(context: Context): Promise<string | null> {
  const parsed = idParamsSchema.safeParse(await context.params);
  return parsed.success ? parsed.data.id : null;
}

/** `PATCH /api/projects/:id`: renames the project. RLS lets owners change `name` only. */
export async function PATCH(request: Request, context: Context): Promise<Response> {
  const owner = await requireOwner();
  if (!owner.ok) return owner.response;

  const json = await readJson(request);
  if (json === undefined) return errorResponse("invalid_request", "The body must be JSON.");
  const parsed = updateProjectRequestSchema.safeParse(json);
  if (!parsed.success) return errorResponse("invalid_request", invalidBodyMessage(parsed.error.issues));

  const id = await projectId(context);
  if (!id) return notFound();

  try {
    const supabase = await createOwnerClient();
    const { data, error } = await supabase
      .from("projects")
      .update({ name: parsed.data.name })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Could not rename project: ${error.message}`);
    if (!data) return notFound();

    const body: ProjectResponse = { project: toProject(data) };
    return Response.json(body);
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}

/**
 * `DELETE /api/projects/:id`: deletes the project and, by cascade, every row in it, then
 * its files in the knowledge bucket.
 *
 * The delete runs through the owner client, so RLS only deletes the caller's own project;
 * a returned row is the ownership check. Only then does the service client touch Storage
 * (project.md §9). Rows first: a leftover file is harmless, a half-deleted project isn't.
 */
export async function DELETE(_request: Request, context: Context): Promise<Response> {
  const owner = await requireOwner();
  if (!owner.ok) return owner.response;

  const id = await projectId(context);
  if (!id) return notFound();

  try {
    const supabase = await createOwnerClient();
    const { data, error } = await supabase.from("projects").delete().eq("id", id).select("id");
    if (error) throw new Error(`Could not delete project: ${error.message}`);
    if (data.length === 0) return notFound();

    await removeFilesAfterDelete(id);

    const body: OkResponse = { ok: true };
    return Response.json(body);
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}

/** Removes the deleted project's files. A failure is logged, never shown: the project is gone. */
async function removeFilesAfterDelete(projectId: string): Promise<void> {
  try {
    await removeProjectFiles(createServiceClient(), projectId);
  } catch (cause) {
    console.error(`Could not remove files of deleted project ${projectId}:`, cause);
  }
}
