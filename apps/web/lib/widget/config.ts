import "server-only";
import {
  DEFAULT_WIDGET_CONFIG,
  PLANS,
  applyPlanToWidgetConfig,
  widgetConfigSchema,
  type Plan,
  type WidgetConfig,
} from "@askwell/shared";
import { createServiceClient } from "../supabase/service";
import type { Tables } from "../supabase/types";

export type WidgetConfigRow = Tables<"widget_configs">;

/** Maps a `widget_configs` row to `WidgetConfig`. Throws if the row breaks the schema. */
export function toWidgetConfig(row: WidgetConfigRow): WidgetConfig {
  return widgetConfigSchema.parse({
    buttonColor: row.button_color,
    position: row.position,
    label: row.label,
    animation: row.animation,
    headerText: row.header_text,
    showBadge: row.show_badge,
  });
}

function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}

/**
 * The plan-applied widget config for a project's public key, or null for an unknown key.
 *
 * Public: the key only identifies the project (project.md §9), so this uses the service
 * client, looks the project up by `public_key` only, and returns nothing but the config.
 * The plan comes from the owner's `accounts` row, and Free gets the defaults with the badge.
 * Throws on a database error or an unknown plan, so a failure never reads as "not found".
 */
export async function getWidgetConfigByKey(key: string): Promise<WidgetConfig | null> {
  const { data, error } = await createServiceClient()
    .from("projects")
    .select("widget_configs(*), accounts(plan)")
    .eq("public_key", key)
    .maybeSingle();

  if (error) throw new Error(`Could not load widget config: ${error.message}`);
  if (!data) return null;

  const plan = data.accounts.plan;
  if (!isPlan(plan)) throw new Error(`Unknown plan: ${plan}`);

  // Every project gets a config row on create; fall back to the defaults if one is missing.
  const saved = data.widget_configs ? toWidgetConfig(data.widget_configs) : DEFAULT_WIDGET_CONFIG;
  return applyPlanToWidgetConfig(plan, saved);
}
