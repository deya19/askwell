import "server-only";
import { PLAN_LIMITS, idParamsSchema, type KnowledgeSourceType } from "@askwell/shared";
import { requireOwner } from "../auth/require-owner";
import { DB_ERROR_CODES } from "../projects/db-errors";
import { errorResponse } from "../projects/http";
import { getOwnerPlan } from "../projects/plan";
import { getOwnedProject, type OwnedProject } from "../supabase/owned-project";
import { createOwnerClient } from "../supabase/owner";
import type { ServiceClient } from "../supabase/service";
import { KNOWLEDGE_BUCKET, STALE_UPLOAD_MS, type KnowledgeSourceRow } from "./source";

export type IdContext = { params: Promise<{ id: string }> };

/** Same answer for a bad id, a missing project and someone else's project (project.md §9). */
export function projectNotFound(): Response {
  return errorResponse("not_found", "Project not found.");
}

export function sourceNotFound(): Response {
  return errorResponse("not_found", "Knowledge source not found.");
}

/** The `:id` param when it's a UUID. Anything else can't match a row. */
export async function idParam(context: IdContext): Promise<string | null> {
  const parsed = idParamsSchema.safeParse(await context.params);
  return parsed.success ? parsed.data.id : null;
}

type OwnedProjectCheck = { ok: true; userId: string; project: OwnedProject } | { ok: false; response: Response };

/**
 * The session check and the ownership check every project knowledge route starts with:
 * 401 when signed out, 404 when the project isn't the caller's. Runs before any
 * service-client call (project.md §9 Tenant leak).
 */
export async function requireOwnedProject(context: IdContext): Promise<OwnedProjectCheck> {
  const owner = await requireOwner();
  if (!owner.ok) return owner;
  const id = await idParam(context);
  const project = id ? await getOwnedProject(id) : null;
  if (!project) return { ok: false, response: projectNotFound() };
  return { ok: true, userId: owner.userId, project };
}

type Reservation = { ok: true; row: KnowledgeSourceRow } | { ok: false; response: Response };

/**
 * Reserves a knowledge source within the plan's limit. The plan is read from the caller's
 * `accounts` row, never the request (project.md §9 Plan bypass). `reserve_knowledge_source`
 * counts and inserts under a lock, so two requests can't both take the last slot.
 */
export async function reserveSource(
  service: ServiceClient,
  args: {
    userId: string;
    projectId: string;
    title: string;
    type: KnowledgeSourceType;
    storageKey?: string;
  },
): Promise<Reservation> {
  const plan = await getOwnerPlan(await createOwnerClient(), args.userId);
  if (!plan) {
    return {
      ok: false,
      response: errorResponse("conflict", "Your account isn't ready yet. Open the dashboard and try again."),
    };
  }

  const limit = PLAN_LIMITS[plan].knowledgeSources;
  const { data, error } = await service
    .rpc("reserve_knowledge_source", {
      project_id: args.projectId,
      title: args.title,
      type: args.type,
      max_sources: limit,
      storage_key: args.storageKey,
    })
    .single();

  if (error?.code === DB_ERROR_CODES.sourceLimitReached) {
    const message =
      plan === "free"
        ? `The Free plan includes ${limit} knowledge sources per project. Upgrade to Pro to add more.`
        : `Your plan includes ${limit} knowledge sources per project. Delete one to add another.`;
    return { ok: false, response: errorResponse("limit_reached", message) };
  }
  // The project was deleted after the ownership check.
  if (error?.code === DB_ERROR_CODES.notFound) return { ok: false, response: projectNotFound() };
  if (error) throw new Error(`Could not reserve knowledge source: ${error.message}`);
  return { ok: true, row: data };
}

/**
 * Reclaims this project's upload reservations older than 2 hours: deletes their Storage
 * objects (a missing object is fine), then their rows, so they stop counting toward the limit.
 */
export async function reclaimStaleUploads(service: ServiceClient, projectId: string, now = Date.now()): Promise<number> {
  const cutoff = new Date(now - STALE_UPLOAD_MS).toISOString();
  const { data, error } = await service
    .from("knowledge_sources")
    .select("id, storage_key")
    .eq("project_id", projectId)
    .eq("status", "uploading")
    .lt("created_at", cutoff);
  if (error) throw new Error(`Could not list stale uploads: ${error.message}`);
  if (data.length === 0) return 0;

  const keys = data.flatMap((row) => (row.storage_key ? [row.storage_key] : []));
  if (keys.length > 0) {
    // `remove` skips paths that don't exist, so an upload that never happened isn't an error.
    const removed = await service.storage.from(KNOWLEDGE_BUCKET).remove(keys);
    if (removed.error) throw new Error(`Could not remove stale uploads: ${removed.error.message}`);
  }

  const { error: deleteError } = await service
    .from("knowledge_sources")
    .delete()
    .eq("project_id", projectId)
    .eq("status", "uploading")
    .in(
      "id",
      data.map((row) => row.id),
    );
  if (deleteError) throw new Error(`Could not delete stale uploads: ${deleteError.message}`);
  return data.length;
}
