import { z } from "zod";
import { MAX_WIDGET_HEADER_TEXT_LENGTH, MAX_WIDGET_LABEL_LENGTH } from "./limits";
import { PLAN_LIMITS, type Plan } from "./plans";

/** `widget_configs.position`: the corner the button sits in. */
export const BUTTON_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;
export const buttonPositionSchema = z.enum(BUTTON_POSITIONS);
export type ButtonPosition = z.infer<typeof buttonPositionSchema>;

/** `widget_configs.animation`: how the panel opens. */
export const OPEN_ANIMATIONS = ["fade", "slide", "scale"] as const;
export const openAnimationSchema = z.enum(OPEN_ANIMATIONS);
export type OpenAnimation = z.infer<typeof openAnimationSchema>;

/** A 6-digit hex color, e.g. `#0a0a0a`. */
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color, like #0a0a0a");

export const widgetConfigSchema = z.object({
  buttonColor: hexColorSchema,
  position: buttonPositionSchema,
  label: z.string().trim().min(1).max(MAX_WIDGET_LABEL_LENGTH),
  animation: openAnimationSchema,
  headerText: z.string().trim().min(1).max(MAX_WIDGET_HEADER_TEXT_LENGTH),
  showBadge: z.boolean(),
});

/** One project's widget settings (`widget_configs`, project.md §6.8). */
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

/** The config every new project gets, and what Free projects always show. */
export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  buttonColor: "#0a0a0a",
  position: "bottom-right",
  label: "Ask a question",
  animation: "fade",
  headerText: "How can we help?",
  showBadge: true,
};

/**
 * The config the widget actually shows for a plan: Free gets the defaults and the badge;
 * Pro gets the saved config (project.md §5, §8). Call it on the server with the plan read there.
 */
export function applyPlanToWidgetConfig(plan: Plan, config: WidgetConfig): WidgetConfig {
  if (!PLAN_LIMITS[plan].customize) {
    return { ...DEFAULT_WIDGET_CONFIG, showBadge: PLAN_LIMITS[plan].showBadge };
  }
  return { ...config };
}
