import {
  MAX_KNOWLEDGE_FILE_BYTES,
  finalizeUploadRequestSchema,
  knowledgeSourceTypeSchema,
  type KnowledgeSourceResponse,
} from "@askwell/shared";
import { after } from "next/server";
import { processKnowledgeSource } from "../../../../../../lib/knowledge/process";
import { requireOwnedProject, sourceNotFound, type IdContext } from "../../../../../../lib/knowledge/routes";
import { KNOWLEDGE_BUCKET, looksLikePdf, toKnowledgeSource } from "../../../../../../lib/knowledge/source";
import { errorResponse, internalErrorResponse, invalidBodyMessage, readJson } from "../../../../../../lib/projects/http";
import { createServiceClient, type ServiceClient } from "../../../../../../lib/supabase/service";

/** Processing runs after the response, within this function's time: long enough for a 10 MB PDF. */
export const maxDuration = 300;

/**
 * `POST /api/projects/:id/knowledge/finalize`: claims an uploaded source once
 * (`uploading` → `processing`), checks the real file, then processes it after responding.
 *
 * A refused file (missing, over 10 MB, or a `.pdf` that isn't a PDF) is deleted and its
 * source marked `failed`: 422 `file_rejected`. A second finalize gets 409 `conflict`.
 */
export async function POST(request: Request, context: IdContext): Promise<Response> {
  try {
    const owned = await requireOwnedProject(context);
    if (!owned.ok) return owned.response;

    const json = await readJson(request);
    if (json === undefined) return errorResponse("invalid_request", "The body must be JSON.");
    const parsed = finalizeUploadRequestSchema.safeParse(json);
    if (!parsed.success) return errorResponse("invalid_request", invalidBodyMessage(parsed.error.issues));

    const projectId = owned.project.id;
    const sourceId = parsed.data.sourceId;
    // Service client only now: the project is the caller's, and every query is scoped to it.
    const service = createServiceClient();

    // One conditional update, so only one finalize can claim the source.
    const { data: source, error } = await service
      .from("knowledge_sources")
      .update({ status: "processing" })
      .eq("id", sourceId)
      .eq("project_id", projectId)
      .eq("status", "uploading")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Could not claim source: ${error.message}`);
    if (!source) return await notClaimed(service, projectId, sourceId);

    const type = knowledgeSourceTypeSchema.parse(source.type);
    const key = source.storage_key;
    if (type === "text" || !key) throw new Error(`Source ${source.id} has no file to finalize.`);

    const download = await service.storage.from(KNOWLEDGE_BUCKET).download(key);
    if (download.error) {
      return await reject(service, source.id, key, "We couldn't find the uploaded file. Upload it again.");
    }
    if (download.data.size > MAX_KNOWLEDGE_FILE_BYTES) {
      return await reject(service, source.id, key, "Files can be up to 10 MB.");
    }
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    if (type === "pdf" && !looksLikePdf(bytes)) {
      return await reject(service, source.id, key, "This file isn't a valid PDF.");
    }

    after(() =>
      processKnowledgeSource(service, { id: source.id, projectId, type }, { kind: "file", bytes }),
    );

    const body: KnowledgeSourceResponse = { source: toKnowledgeSource(source) };
    return Response.json(body);
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}

/** 409 if the source is in this project but not `uploading`; 404 if it isn't in this project. */
async function notClaimed(service: ServiceClient, projectId: string, sourceId: string): Promise<Response> {
  const { data, error } = await service
    .from("knowledge_sources")
    .select("id")
    .eq("id", sourceId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Could not load source: ${error.message}`);
  if (!data) return sourceNotFound();
  return errorResponse("conflict", "This file was already finalized.");
}

/** Deletes the refused object, marks the source `failed`, and returns 422 `file_rejected`. */
async function reject(service: ServiceClient, sourceId: string, key: string, message: string): Promise<Response> {
  const removed = await service.storage.from(KNOWLEDGE_BUCKET).remove([key]);
  if (removed.error) throw new Error(`Could not delete refused file: ${removed.error.message}`);

  const { error } = await service.from("knowledge_sources").update({ status: "failed" }).eq("id", sourceId);
  if (error) throw new Error(`Could not mark source failed: ${error.message}`);
  return errorResponse("file_rejected", message);
}
