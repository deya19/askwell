import { z } from "zod";

/** Every error code an API route may return, with its HTTP status. */
export const API_ERROR_STATUS = {
  /** The input failed its zod schema. */
  invalid_request: 400,
  /** No Clerk session on an owner route. */
  unauthorized: 401,
  /** The feature needs Pro (e.g. saving widget config on Free). */
  plan_required: 402,
  /** A plan limit is reached (projects, knowledge sources). */
  limit_reached: 402,
  /** Blocked by Arcjet (prompt injection or bot). */
  forbidden: 403,
  /** Not found, or not owned by the caller. Never reveal which. */
  not_found: 404,
  /** The resource is in the wrong state (e.g. a source already finalized). */
  conflict: 409,
  /** The uploaded file failed the size, type or content check. */
  file_rejected: 422,
  /** Arcjet rate limit hit. */
  rate_limited: 429,
  /** The project's monthly message quota is used up. */
  quota_exceeded: 429,
  /** Anything unexpected. Don't leak details in the message. */
  internal_error: 500,
} as const satisfies Record<string, number>;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

export const API_ERROR_CODES = Object.keys(API_ERROR_STATUS) as ApiErrorCode[];

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES as [ApiErrorCode, ...ApiErrorCode[]]);

/** The body of every error response: `{ error: { code, message } }`. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/** Builds an error body. Send it with `API_ERROR_STATUS[code]`. */
export function apiError(code: ApiErrorCode, message: string): ApiError {
  return { error: { code, message } };
}

/** `{ ok: true }`, returned by deletes. */
export const okResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof okResponseSchema>;
