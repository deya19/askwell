import { MAX_WIDGET_HEADER_TEXT_LENGTH, MAX_WIDGET_LABEL_LENGTH } from "../../../packages/shared/src/limits";
import type { ButtonPosition, OpenAnimation, WidgetConfig } from "../../../packages/shared/src/widget-config";

/**
 * Checks the `GET /api/widget/config` response in the loader.
 *
 * The server validates with `widgetConfigResponseSchema` (zod). The loader can't bundle zod
 * (see `widget-messages.ts`), so this is a plain guard for the same shape. Types come from
 * `packages/shared` (type-only imports, erased at build); the `Record`s below fail typecheck
 * if a position or animation is added there and not here.
 */

/** Gap between the viewport edge and the button, in px. */
export const EDGE_GAP = 20;
/** Button height, in px. The panel sits this far plus a gap from the edge. */
export const BUTTON_HEIGHT = 52;
/** Gap between button and panel, in px. */
export const PANEL_GAP = 12;

type Corner = { vertical: "top" | "bottom"; horizontal: "left" | "right" };

const CORNERS: Record<ButtonPosition, Corner> = {
  "bottom-right": { vertical: "bottom", horizontal: "right" },
  "bottom-left": { vertical: "bottom", horizontal: "left" },
  "top-right": { vertical: "top", horizontal: "right" },
  "top-left": { vertical: "top", horizontal: "left" },
};

const ANIMATIONS: Record<OpenAnimation, true> = { fade: true, slide: true, scale: true };

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= max;
}

function hasKey<K extends string>(map: Record<K, unknown>, value: unknown): value is K {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(map, value);
}

/** The config from a `{ config }` response body, or null if anything is off. Never throws. */
export function parseConfigResponse(body: unknown): WidgetConfig | null {
  try {
    if (!isRecord(body) || !isRecord(body.config)) return null;
    const c = body.config;
    if (
      typeof c.buttonColor !== "string" ||
      !HEX_COLOR.test(c.buttonColor) ||
      !hasKey(CORNERS, c.position) ||
      !isText(c.label, MAX_WIDGET_LABEL_LENGTH) ||
      !hasKey(ANIMATIONS, c.animation) ||
      !isText(c.headerText, MAX_WIDGET_HEADER_TEXT_LENGTH) ||
      typeof c.showBadge !== "boolean"
    ) {
      return null;
    }
    return {
      buttonColor: c.buttonColor,
      position: c.position,
      label: c.label.trim(),
      animation: c.animation,
      headerText: c.headerText.trim(),
      showBadge: c.showBadge,
    };
  } catch {
    return null;
  }
}

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export function textColorOn(hex: string): "#ffffff" | "#0a0a0a" {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // Contrast with white beats contrast with near-black when luminance is below ~0.18.
  return luminance < 0.18 ? "#ffffff" : "#0a0a0a";
}

/**
 * The CSS custom properties for one config. The stylesheet (styles.ts) reads them, so no
 * config value is ever spliced into CSS text. Values are already validated.
 */
export function configStyleVars(config: WidgetConfig): Record<string, string> {
  const { vertical, horizontal } = CORNERS[config.position];
  const other = (side: string, sides: [string, string]) => (side === sides[0] ? sides[1] : sides[0]);
  const auto = "auto";
  const edge = `${EDGE_GAP}px`;
  const panelOffset = `${EDGE_GAP + BUTTON_HEIGHT + PANEL_GAP}px`;
  return {
    "--aw-color": config.buttonColor,
    "--aw-text": textColorOn(config.buttonColor),
    [`--aw-btn-${vertical}`]: edge,
    [`--aw-btn-${other(vertical, ["top", "bottom"])}`]: auto,
    [`--aw-btn-${horizontal}`]: edge,
    [`--aw-btn-${other(horizontal, ["left", "right"])}`]: auto,
    [`--aw-panel-${vertical}`]: panelOffset,
    [`--aw-panel-${other(vertical, ["top", "bottom"])}`]: auto,
    [`--aw-panel-${horizontal}`]: edge,
    [`--aw-panel-${other(horizontal, ["left", "right"])}`]: auto,
    // Slide moves the panel in from the button's side; scale grows from the button's corner.
    "--aw-slide": vertical === "bottom" ? "16px" : "-16px",
    "--aw-origin": `${vertical} ${horizontal}`,
  };
}
