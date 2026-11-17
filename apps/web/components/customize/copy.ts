import {
  APP_NAME,
  widgetConfigSchema,
  type ButtonPosition,
  type OpenAnimation,
  type WidgetConfig,
} from "@askwell/shared";

/** The Customize page for a project. */
export function customizePath(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}/customize`;
}

/** Where the upgrade prompt sends Free owners. */
export const UPGRADE_PATH = "/dashboard/billing";

export const UPGRADE_TITLE = "Customizing the widget is a Pro feature";
export const UPGRADE_MESSAGE = `Upgrade to ${APP_NAME} Pro to change the button's color, corner, label and animation, the header text, and to hide the "Powered by" badge.`;

export const POSITION_LABELS: Record<ButtonPosition, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};

/** The corners in reading order, so the picker is laid out as a 2×2 grid. */
export const POSITION_GRID: readonly ButtonPosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

export const ANIMATION_LABELS: Record<OpenAnimation, string> = {
  fade: "Fade",
  slide: "Slide",
  scale: "Scale",
};

export type FieldErrors = Partial<Record<keyof WidgetConfig, string>>;

const FIELDS = Object.keys(widgetConfigSchema.shape) as (keyof WidgetConfig)[];

/** Validates the draft with the shared schema: the parsed config, or one message per bad field. */
export function validateDraft(
  draft: WidgetConfig,
): { ok: true; config: WidgetConfig } | { ok: false; errors: FieldErrors } {
  const parsed = widgetConfigSchema.safeParse(draft);
  if (parsed.success) return { ok: true, config: parsed.data };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && isField(field) && !errors[field]) errors[field] = fieldMessage(field, issue.message);
  }
  return { ok: false, errors };
}

function isField(value: string): value is keyof WidgetConfig {
  return (FIELDS as string[]).includes(value);
}

const TEXT_FIELD_NAMES: Partial<Record<keyof WidgetConfig, string>> = { label: "The label", headerText: "The header text" };

function fieldMessage(field: keyof WidgetConfig, fallback: string): string {
  if (field === "buttonColor") return "Use a 6-digit hex color, like #0a0a0a.";
  const name = TEXT_FIELD_NAMES[field];
  if (name) return `${name} can't be empty or too long.`;
  return fallback;
}

/**
 * What the preview shows: each valid field from the draft, and the last good value for a
 * field that doesn't pass the schema yet (e.g. a half-typed color), so the preview never breaks.
 */
export function previewConfig(draft: WidgetConfig, fallback: WidgetConfig): WidgetConfig {
  const shape = widgetConfigSchema.shape;
  return {
    buttonColor: pick(shape.buttonColor, draft.buttonColor, fallback.buttonColor),
    position: pick(shape.position, draft.position, fallback.position),
    label: pick(shape.label, draft.label, fallback.label),
    animation: pick(shape.animation, draft.animation, fallback.animation),
    headerText: pick(shape.headerText, draft.headerText, fallback.headerText),
    showBadge: draft.showBadge,
  };
}

type FieldSchema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

function pick<T>(schema: FieldSchema<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

/** True when the draft differs from the saved config (text trimmed, color case ignored). */
export function isDirty(draft: WidgetConfig, saved: WidgetConfig): boolean {
  return FIELDS.some((field) => normalize(field, draft[field]) !== normalize(field, saved[field]));
}

function normalize(field: keyof WidgetConfig, value: WidgetConfig[keyof WidgetConfig]): unknown {
  if (typeof value !== "string") return value;
  return field === "buttonColor" ? value.toLowerCase() : value.trim();
}

/** Black or white, whichever reads better on `hex`. Same rule as the widget loader's `textColorOn`. */
export function textColorOn(hex: string): "#ffffff" | "#0a0a0a" {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance < 0.18 ? "#ffffff" : "#0a0a0a";
}

/** Which edges of the preview frame the button and panel sit against. */
export function cornerSides(position: ButtonPosition): { vertical: "top" | "bottom"; horizontal: "left" | "right" } {
  const [vertical, horizontal] = position.split("-") as ["top" | "bottom", "left" | "right"];
  return { vertical, horizontal };
}
