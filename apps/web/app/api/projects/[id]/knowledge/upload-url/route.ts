import {
  MAX_KNOWLEDGE_TITLE_LENGTH,
  createUploadUrlRequestSchema,
  knowledgeFileTypeFromName,
  type CreateUploadUrlResponse,
} from "@askwell/shared";
import { reclaimStaleUploads, requireOwnedProject, reserveSource, type IdContext } from "../../../../../../lib/knowledge/routes";
import {
  KNOWLEDGE_BUCKET,
  storageKeyFor,
  titleFromFileName,
  toKnowledgeSource,
} from "../../../../../../lib/knowledge/source";
import { errorResponse, internalErrorResponse, invalidBodyMessage, readJson } from "../../../../../../lib/projects/http";
import { createServiceClient } from "../../../../../../lib/supabase/service";

/**
 * `POST /api/projects/:id/knowledge/upload-url`: reserves a file source as `uploading`
 * (it counts toward the limit) and returns a one-time signed upload URL for it.
 *
 * First reclaims this project's reservations that were never finalized within 2 hours.
 * The declared name and size are checked by the schema; finalize checks the real file.
 */
export async function POST(request: Request, context: IdContext): Promise<Response> {
  try {
    const owned = await requireOwnedProject(context);
    if (!owned.ok) return owned.response;

    const json = await readJson(request);
    if (json === undefined) return errorResponse("invalid_request", "The body must be JSON.");
    const parsed = createUploadUrlRequestSchema.safeParse(json);
    if (!parsed.success) return errorResponse("invalid_request", invalidBodyMessage(parsed.error.issues));

    const type = knowledgeFileTypeFromName(parsed.data.fileName);
    if (!type) return errorResponse("invalid_request", "fileName: Upload a PDF, Markdown or TXT file");
    const projectId = owned.project.id;

    // Service client only now: the project is the caller's.
    const service = createServiceClient();
    await reclaimStaleUploads(service, projectId);

    const storageKey = storageKeyFor(projectId, crypto.randomUUID(), type);
    const reserved = await reserveSource(service, {
      userId: owned.userId,
      projectId,
      title: parsed.data.title ?? titleFromFileName(parsed.data.fileName, MAX_KNOWLEDGE_TITLE_LENGTH),
      type,
      storageKey,
    });
    if (!reserved.ok) return reserved.response;

    const signed = await service.storage.from(KNOWLEDGE_BUCKET).createSignedUploadUrl(storageKey);
    if (signed.error) {
      // Give the slot back: without a URL the owner can't upload to this reservation.
      await service.from("knowledge_sources").delete().eq("id", reserved.row.id).eq("status", "uploading");
      throw new Error(`Could not sign upload URL: ${signed.error.message}`);
    }

    const body: CreateUploadUrlResponse = {
      source: toKnowledgeSource(reserved.row),
      upload: { path: signed.data.path, token: signed.data.token, signedUrl: signed.data.signedUrl },
    };
    return Response.json(body, { status: 201 });
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}
