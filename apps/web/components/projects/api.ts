import {
  apiErrorSchema,
  okResponseSchema,
  projectResponseSchema,
  type ApiErrorCode,
  type CreateProjectRequest,
  type OkResponse,
  type ProjectResponse,
  type UpdateProjectRequest,
} from "@askwell/shared";

/** Any zod schema; apps/web doesn't depend on zod directly. */
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ApiErrorCode | "network_error"; message: string };

const FALLBACK_MESSAGE = "Something went wrong. Try again.";

/**
 * Reads a route's response: the parsed body on success, or the `{ error: { code, message } }`
 * body on failure. Anything else (HTML error page, bad JSON) becomes a generic error.
 */
export async function readApiResponse<T>(response: Response, schema: Schema<T>): Promise<ApiResult<T>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (response.ok) {
    const parsed = schema.safeParse(body);
    if (parsed.success) return { ok: true, data: parsed.data };
    return { ok: false, code: "internal_error", message: FALLBACK_MESSAGE };
  }

  const error = apiErrorSchema.safeParse(body);
  if (error.success) return { ok: false, ...error.data.error };
  return { ok: false, code: "internal_error", message: FALLBACK_MESSAGE };
}

async function send<T>(url: string, init: RequestInit, schema: Schema<T>): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    return { ok: false, code: "network_error", message: "Couldn't reach the server. Check your connection." };
  }
  return readApiResponse(response, schema);
}

function projectUrl(id: string): string {
  return `/api/projects/${encodeURIComponent(id)}`;
}

export function createProject(body: CreateProjectRequest): Promise<ApiResult<ProjectResponse>> {
  return send("/api/projects", { method: "POST", body: JSON.stringify(body) }, projectResponseSchema);
}

export function renameProject(id: string, body: UpdateProjectRequest): Promise<ApiResult<ProjectResponse>> {
  return send(projectUrl(id), { method: "PATCH", body: JSON.stringify(body) }, projectResponseSchema);
}

export function deleteProject(id: string): Promise<ApiResult<OkResponse>> {
  return send(projectUrl(id), { method: "DELETE" }, okResponseSchema);
}
