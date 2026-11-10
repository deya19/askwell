import { API_ERROR_STATUS, apiError } from "@askwell/shared";

/** The 401 an owner API route returns when there is no Clerk session. */
export function unauthorizedResponse(): Response {
  return Response.json(apiError("unauthorized", "Sign in to continue."), {
    status: API_ERROR_STATUS.unauthorized,
  });
}
