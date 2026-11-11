import { API_ERROR_STATUS, apiError, type ApiErrorCode } from "@askwell/shared";

/** An `{ error: { code, message } }` response with the code's HTTP status. */
export function errorResponse(code: ApiErrorCode, message: string): Response {
  return Response.json(apiError(code, message), { status: API_ERROR_STATUS[code] });
}

/** The 500 for anything unexpected. Logs the cause on the server; the client gets no details. */
export function internalErrorResponse(cause: unknown): Response {
  console.error(cause);
  return errorResponse("internal_error", "Something went wrong. Try again.");
}

/** The request's JSON body, or `undefined` when it isn't valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** A message for a body that failed its schema. Names the first bad field. */
export function invalidBodyMessage(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  const issue = issues[0];
  if (!issue) return "Invalid request body.";
  const field = issue.path.map(String).join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}
