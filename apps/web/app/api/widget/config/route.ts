import { widgetConfigQuerySchema, type WidgetConfigResponse } from "@askwell/shared";
import { protectWidgetConfig } from "../../../../lib/arcjet/config";
import { getWidgetConfigByKey } from "../../../../lib/widget/config";
import {
  widgetErrorResponse,
  widgetInternalErrorResponse,
  widgetJson,
  widgetPreflightResponse,
} from "../../../../lib/widget/http";

/** A Pro owner's change shows within a minute. */
const CACHE_CONTROL = "public, max-age=60";

/**
 * `GET /api/widget/config?key=pk_...`: the plan-applied widget config (project.md §6.5, §8).
 * Public and called from any origin. Returns the config only, nothing else about the project.
 */
export async function GET(request: Request): Promise<Response> {
  const protection = await protectWidgetConfig(request);
  if (!protection.allowed) {
    return protection.reason === "rate_limit"
      ? widgetErrorResponse("rate_limited", "Too many requests. Try again in a minute.")
      : widgetErrorResponse("forbidden", "Request blocked.");
  }

  const params = new URL(request.url).searchParams;
  const parsed = widgetConfigQuerySchema.safeParse({ key: params.get("key") ?? undefined });
  if (!parsed.success) return widgetErrorResponse("invalid_request", "Send a valid public key as ?key=pk_...");

  try {
    const config = await getWidgetConfigByKey(parsed.data.key);
    if (!config) return widgetErrorResponse("not_found", "No widget for this key.");

    const body: WidgetConfigResponse = { config };
    return widgetJson(body, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (cause) {
    return widgetInternalErrorResponse(cause);
  }
}

/** CORS preflight. */
export function OPTIONS(): Response {
  return widgetPreflightResponse();
}
