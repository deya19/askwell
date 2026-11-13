import { chatRequestSchema } from "@askwell/shared";
import { handleChat } from "../../../../lib/chat/handle";
import {
  widgetErrorResponse,
  widgetInternalErrorResponse,
  widgetJson,
  widgetPreflightResponse,
} from "../../../../lib/widget/http";

/**
 * `POST /api/widget/chat`: the bot answers from the project's documents (project.md §6.6, §8).
 * Public and called from any origin. The project comes from `key` only.
 */
export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return widgetErrorResponse("invalid_request", "Send a JSON body.");
  }
  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) return widgetErrorResponse("invalid_request", "Send a valid key, visitorId and message.");

  try {
    const outcome = await handleChat(request, parsed.data);
    if (outcome.ok) return widgetJson(outcome.body, { headers: { "Cache-Control": "no-store" } });
    if (outcome.cause !== undefined) console.error(outcome.cause);
    return widgetErrorResponse(outcome.code, outcome.message);
  } catch (cause) {
    return widgetInternalErrorResponse(cause);
  }
}

/** CORS preflight. */
export function OPTIONS(): Response {
  return widgetPreflightResponse();
}
