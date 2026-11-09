import { z } from "zod";
import { MAX_PROJECT_NAME_LENGTH } from "../limits";
import { widgetConfigSchema } from "../widget-config";
import { idSchema, publicKeySchema, timestampSchema } from "./common";

// Owner routes: Clerk session required.

export const projectNameSchema = z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH);

/** A project as the dashboard sees it. */
export const projectSchema = z.object({
  id: idSchema,
  name: z.string(),
  publicKey: publicKeySchema,
  messagesUsed: z.number().int().nonnegative(),
  periodStart: timestampSchema,
  createdAt: timestampSchema,
});
export type Project = z.infer<typeof projectSchema>;

/** `GET /api/projects` response, newest first. */
export const listProjectsResponseSchema = z.object({ projects: z.array(projectSchema) });
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;

/** `POST /api/projects` body. */
export const createProjectRequestSchema = z.object({ name: projectNameSchema });
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

/** `PATCH /api/projects/:id` body. Only the name can change. */
export const updateProjectRequestSchema = z.object({ name: projectNameSchema });
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

/** `POST /api/projects` and `PATCH /api/projects/:id` response. */
export const projectResponseSchema = z.object({ project: projectSchema });
export type ProjectResponse = z.infer<typeof projectResponseSchema>;

// `DELETE /api/projects/:id` returns `OkResponse`.

/** `PATCH /api/projects/:id/config` body: any subset of fields, at least one. 402 on Free. */
export const updateWidgetConfigRequestSchema = widgetConfigSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Send at least one field" });
export type UpdateWidgetConfigRequest = z.infer<typeof updateWidgetConfigRequestSchema>;

/** `PATCH /api/projects/:id/config` response: the saved config. */
export const widgetConfigUpdateResponseSchema = z.object({ config: widgetConfigSchema });
export type WidgetConfigUpdateResponse = z.infer<typeof widgetConfigUpdateResponseSchema>;
