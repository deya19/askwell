import {
  PLAN_LIMITS,
  idParamsSchema,
  updateWidgetConfigRequestSchema,
  type WidgetConfigUpdateResponse,
} from "@askwell/shared";
import { requireOwner } from "../../../../../lib/auth/require-owner";
import { getOwnerPlan } from "../../../../../lib/projects/plan";
import { errorResponse, internalErrorResponse, invalidBodyMessage, readJson } from "../../../../../lib/projects/http";
import { getOwnedProject } from "../../../../../lib/supabase/owned-project";
import { createOwnerClient } from "../../../../../lib/supabase/owner";
import { getSavedWidgetConfig, mergeWidgetConfig, saveWidgetConfig } from "../../../../../lib/widget/update-config";

type Context = { params: Promise<{ id: string }> };

/**
 * `PATCH /api/projects/:id/config`: saves any subset of the widget settings (project.md §6.8).
 *
 * Order matters: signed in (401), the caller's own project through RLS (404, same answer for
 * a bad id, a missing project and someone else's), the plan read on the server from the
 * caller's `accounts` row (402 on Free, nothing written), then the body (400). Only after
 * all of that does the service client write (project.md §9 Plan bypass, Tenant leak).
 */
export async function PATCH(request: Request, context: Context): Promise<Response> {
  const owner = await requireOwner();
  if (!owner.ok) return owner.response;

  const params = idParamsSchema.safeParse(await context.params);
  if (!params.success) return notFound();

  try {
    const project = await getOwnedProject(params.data.id);
    if (!project) return notFound();

    const supabase = await createOwnerClient();
    // No account row yet: treat as Free, never more.
    const plan = (await getOwnerPlan(supabase, owner.userId)) ?? "free";
    if (!PLAN_LIMITS[plan].customize) {
      return errorResponse("plan_required", "Customizing the widget needs the Pro plan.");
    }

    const json = await readJson(request);
    if (json === undefined) return errorResponse("invalid_request", "The body must be JSON.");
    const parsed = updateWidgetConfigRequestSchema.safeParse(json);
    if (!parsed.success) return errorResponse("invalid_request", invalidBodyMessage(parsed.error.issues));

    const current = await getSavedWidgetConfig(supabase, project.id);
    const config = await saveWidgetConfig(project.id, mergeWidgetConfig(current, parsed.data));

    const body: WidgetConfigUpdateResponse = { config };
    return Response.json(body);
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}

function notFound(): Response {
  return errorResponse("not_found", "Project not found.");
}
