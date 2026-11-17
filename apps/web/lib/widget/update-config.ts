import "server-only";
import {
  DEFAULT_WIDGET_CONFIG,
  widgetConfigSchema,
  type UpdateWidgetConfigRequest,
  type WidgetConfig,
} from "@askwell/shared";
import type { OwnerClient } from "../supabase/owner";
import { createServiceClient } from "../supabase/service";
import { toWidgetConfig, type WidgetConfigRow } from "./config";

/** The saved config with the update's fields on top. Throws if the result breaks the schema. */
export function mergeWidgetConfig(current: WidgetConfig, update: UpdateWidgetConfigRequest): WidgetConfig {
  return widgetConfigSchema.parse({ ...current, ...update });
}

/** Maps a config to its `widget_configs` row. */
export function toWidgetConfigRow(projectId: string, config: WidgetConfig): WidgetConfigRow {
  return {
    project_id: projectId,
    button_color: config.buttonColor,
    position: config.position,
    label: config.label,
    animation: config.animation,
    header_text: config.headerText,
    show_badge: config.showBadge,
  };
}

/**
 * The project's saved config, read through the owner client (RLS). The defaults when the
 * row is missing. The caller checks the project is theirs first. Throws on a database error.
 */
export async function getSavedWidgetConfig(supabase: OwnerClient, projectId: string): Promise<WidgetConfig> {
  const { data, error } = await supabase
    .from("widget_configs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Could not load widget config: ${error.message}`);
  return data ? toWidgetConfig(data) : DEFAULT_WIDGET_CONFIG;
}

/**
 * Writes the project's whole config with the service client (owners can't write
 * `widget_configs` through RLS) and returns what was saved. Call it only after the route
 * has checked ownership and the plan (project.md §9). Throws on a database error.
 */
export async function saveWidgetConfig(projectId: string, config: WidgetConfig): Promise<WidgetConfig> {
  const { data, error } = await createServiceClient()
    .from("widget_configs")
    .upsert(toWidgetConfigRow(projectId, config), { onConflict: "project_id" })
    .select("*")
    .single();
  if (error) throw new Error(`Could not save widget config: ${error.message}`);
  return toWidgetConfig(data);
}
