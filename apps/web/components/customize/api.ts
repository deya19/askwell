import {
  widgetConfigUpdateResponseSchema,
  type UpdateWidgetConfigRequest,
  type WidgetConfigUpdateResponse,
} from "@askwell/shared";
import { readApiResponse, type ApiResult } from "../projects/api";

/**
 * `PATCH /api/projects/:id/config`. The server reads the plan and answers 402
 * `plan_required` on Free; the caller shows the upgrade prompt for that code.
 */
export async function saveWidgetConfig(
  projectId: string,
  body: UpdateWidgetConfigRequest,
): Promise<ApiResult<WidgetConfigUpdateResponse>> {
  let response: Response;
  try {
    response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: "network_error", message: "Couldn't reach the server. Check your connection." };
  }
  return readApiResponse(response, widgetConfigUpdateResponseSchema);
}
