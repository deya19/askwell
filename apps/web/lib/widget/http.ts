import { API_ERROR_STATUS, apiError, type ApiErrorCode } from "@askwell/shared";

/**
 * CORS for public widget routes: any origin, no credentials (project.md §9 CORS).
 * Owner routes never send these.
 */
export const WIDGET_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

/** Errors are never cached, so a fixed key or a new project shows up at once. */
const NO_STORE = { "Cache-Control": "no-store" } as const;

/** A JSON response with the widget CORS headers. */
export function widgetJson(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { ...WIDGET_CORS_HEADERS, ...init.headers },
  });
}

/** An `{ error: { code, message } }` response with CORS headers and no caching. */
export function widgetErrorResponse(code: ApiErrorCode, message: string): Response {
  return widgetJson(apiError(code, message), { status: API_ERROR_STATUS[code], headers: NO_STORE });
}

/** The 500 for anything unexpected. Logs the cause on the server; the client gets no details. */
export function widgetInternalErrorResponse(cause: unknown): Response {
  console.error(cause);
  return widgetErrorResponse("internal_error", "Something went wrong. Try again.");
}

/** The answer to a CORS preflight. */
export function widgetPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: WIDGET_CORS_HEADERS });
}
