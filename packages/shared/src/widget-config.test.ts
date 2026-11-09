import { describe, expect, test } from "vitest";
import { applyPlanToWidgetConfig, DEFAULT_WIDGET_CONFIG, widgetConfigSchema, type WidgetConfig } from "./widget-config";

const custom: WidgetConfig = {
  buttonColor: "#ff5500",
  position: "top-left",
  label: "Help",
  animation: "scale",
  headerText: "Hi there",
  showBadge: false,
};

describe("DEFAULT_WIDGET_CONFIG", () => {
  test("is bottom-right, fade, with the badge shown", () => {
    expect(DEFAULT_WIDGET_CONFIG.position).toBe("bottom-right");
    expect(DEFAULT_WIDGET_CONFIG.animation).toBe("fade");
    expect(DEFAULT_WIDGET_CONFIG.showBadge).toBe(true);
  });

  test("passes its own schema", () => {
    expect(widgetConfigSchema.parse(DEFAULT_WIDGET_CONFIG)).toEqual(DEFAULT_WIDGET_CONFIG);
  });
});

describe("widgetConfigSchema", () => {
  test("accepts a full custom config", () => {
    expect(widgetConfigSchema.parse(custom)).toEqual(custom);
  });

  test.each([
    ["a non-hex color", { buttonColor: "red" }],
    ["a 3-digit color", { buttonColor: "#fff" }],
    ["an unknown position", { position: "center" }],
    ["an unknown animation", { animation: "bounce" }],
    ["an empty label", { label: "   " }],
    ["a long header", { headerText: "x".repeat(81) }],
  ])("rejects %s", (_, patch) => {
    expect(widgetConfigSchema.safeParse({ ...custom, ...patch }).success).toBe(false);
  });
});

describe("applyPlanToWidgetConfig", () => {
  test("Free gets the defaults and the badge, whatever is saved", () => {
    expect(applyPlanToWidgetConfig("free", custom)).toEqual({ ...DEFAULT_WIDGET_CONFIG, showBadge: true });
  });

  test("Pro gets the saved config", () => {
    expect(applyPlanToWidgetConfig("pro", custom)).toEqual(custom);
  });
});
