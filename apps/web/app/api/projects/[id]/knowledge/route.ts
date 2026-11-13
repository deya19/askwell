import { createTextSourceRequestSchema, type KnowledgeSourceResponse } from "@askwell/shared";
import { after } from "next/server";
import { processKnowledgeSource } from "../../../../../lib/knowledge/process";
import { requireOwnedProject, reserveSource, type IdContext } from "../../../../../lib/knowledge/routes";
import { toKnowledgeSource } from "../../../../../lib/knowledge/source";
import { errorResponse, internalErrorResponse, invalidBodyMessage, readJson } from "../../../../../lib/projects/http";
import { createServiceClient } from "../../../../../lib/supabase/service";

/** Processing runs after the response, within this function's time (embedding up to 100k characters). */
export const maxDuration = 300;

/**
 * `POST /api/projects/:id/knowledge`: adds pasted text as a source, within the plan's
 * source limit, and processes it after responding. Responds 201 with the `processing` source.
 */
export async function POST(request: Request, context: IdContext): Promise<Response> {
  try {
    const owned = await requireOwnedProject(context);
    if (!owned.ok) return owned.response;

    const json = await readJson(request);
    if (json === undefined) return errorResponse("invalid_request", "The body must be JSON.");
    const parsed = createTextSourceRequestSchema.safeParse(json);
    if (!parsed.success) return errorResponse("invalid_request", invalidBodyMessage(parsed.error.issues));

    // Service client only now: the project is the caller's.
    const service = createServiceClient();
    const reserved = await reserveSource(service, {
      userId: owned.userId,
      projectId: owned.project.id,
      title: parsed.data.title,
      type: "text",
    });
    if (!reserved.ok) return reserved.response;

    const source = reserved.row;
    after(() =>
      processKnowledgeSource(
        service,
        { id: source.id, projectId: source.project_id, type: "text" },
        { kind: "text", text: parsed.data.content },
      ),
    );

    const body: KnowledgeSourceResponse = { source: toKnowledgeSource(source) };
    return Response.json(body, { status: 201 });
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}
