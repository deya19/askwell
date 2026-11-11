import {
  PLAN_LIMITS,
  createProjectRequestSchema,
  type ListProjectsResponse,
  type ProjectResponse,
} from "@askwell/shared";
import { requireOwner } from "../../../lib/auth/require-owner";
import { DB_ERROR_CODES } from "../../../lib/projects/db-errors";
import { errorResponse, internalErrorResponse, invalidBodyMessage, readJson } from "../../../lib/projects/http";
import { getOwnerPlan } from "../../../lib/projects/plan";
import { toProject } from "../../../lib/projects/project";
import { createOwnerClient } from "../../../lib/supabase/owner";
import { createServiceClient } from "../../../lib/supabase/service";

/** `GET /api/projects`: the caller's projects, newest first. RLS scopes the read. */
export async function GET(): Promise<Response> {
  const owner = await requireOwner();
  if (!owner.ok) return owner.response;

  try {
    const supabase = await createOwnerClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not list projects: ${error.message}`);

    const body: ListProjectsResponse = { projects: data.map(toProject) };
    return Response.json(body);
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}

/**
 * `POST /api/projects`: creates a project, within the plan's project limit.
 *
 * The plan comes from the caller's `accounts` row, never the request. `create_project`
 * counts and inserts under a lock, so two requests can't both take the last slot.
 */
export async function POST(request: Request): Promise<Response> {
  const owner = await requireOwner();
  if (!owner.ok) return owner.response;

  const json = await readJson(request);
  if (json === undefined) return errorResponse("invalid_request", "The body must be JSON.");
  const parsed = createProjectRequestSchema.safeParse(json);
  if (!parsed.success) return errorResponse("invalid_request", invalidBodyMessage(parsed.error.issues));

  try {
    const plan = await getOwnerPlan(await createOwnerClient(), owner.userId);
    if (!plan) return accountMissing();

    // Service client only now: the owner is the session user and their plan is known.
    const { data, error } = await createServiceClient()
      .rpc("create_project", {
        owner_id: owner.userId,
        name: parsed.data.name,
        max_projects: PLAN_LIMITS[plan].projects,
      })
      .single();

    if (error?.code === DB_ERROR_CODES.projectLimitReached) {
      const limit = PLAN_LIMITS[plan].projects;
      const message =
        plan === "free"
          ? `The Free plan includes ${limit} project. Upgrade to Pro to add more.`
          : `Your plan includes ${limit} projects. Delete one to add another.`;
      return errorResponse("limit_reached", message);
    }
    // The account was deleted between the plan read and the insert.
    if (error?.code === DB_ERROR_CODES.notFound) return accountMissing();
    if (error) throw new Error(`Could not create project: ${error.message}`);

    const body: ProjectResponse = { project: toProject(data) };
    return Response.json(body, { status: 201 });
  } catch (cause) {
    return internalErrorResponse(cause);
  }
}

function accountMissing(): Response {
  return errorResponse("conflict", "Your account isn't ready yet. Open the dashboard and try again.");
}
