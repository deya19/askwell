import type { ApiErrorCode } from "@askwell/shared";
import { errorResponse } from "../projects/http";

/** Conversations are private and change with every chat: never cached. */
export const NO_STORE = { "Cache-Control": "no-store" } as const;

/** A JSON body that's never cached. */
export function noStoreJson(body: unknown): Response {
  return Response.json(body, { headers: NO_STORE });
}

/** An `{ error: { code, message } }` response that's never cached. */
export function noStoreError(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function noStoreErrorResponse(code: ApiErrorCode, message: string): Response {
  return noStoreError(errorResponse(code, message));
}
