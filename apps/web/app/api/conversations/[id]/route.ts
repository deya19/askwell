import { idParamsSchema } from "@askwell/shared";
import { requireOwner } from "../../../../lib/auth/require-owner";
import { getConversation } from "../../../../lib/conversations/queries";
import { noStoreError, noStoreErrorResponse, noStoreJson } from "../../../../lib/conversations/http";
import { internalErrorResponse } from "../../../../lib/projects/http";

type Context = { params: Promise<{ id: string }> };

/**
 * `GET /api/conversations/:id`: one conversation and its thread, oldest message first.
 * Read through the owner client, so RLS hides other owners' conversations: those get the
 * same 404 as a missing one (project.md §9).
 */
export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return noStoreError(owner.response);

    const parsed = idParamsSchema.safeParse(await context.params);
    if (!parsed.success) return noStoreErrorResponse("invalid_request", "The conversation id must be a UUID.");

    const conversation = await getConversation(parsed.data.id);
    if (!conversation) return noStoreErrorResponse("not_found", "Conversation not found.");

    return noStoreJson(conversation);
  } catch (cause) {
    return noStoreError(internalErrorResponse(cause));
  }
}
