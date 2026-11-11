import { describe, expect, test } from "vitest";
import { DEFAULT_WIDGET_CONFIG, type WidgetConfig } from "../../../packages/shared/src/widget-config";
import { configStyleVars, parseConfigResponse, textColorOn } from "./config";

const PRO: WidgetConfig = {
  buttonColor: "#ff6600",
  position: "top-left",
  label: "Need help?",
  animation: "slide",
  headerText: "Support",
  showBadge: false,
};

describe("parseConfigResponse", () => {
  test("accepts the default config and a custom one", () => {
    expect(parseConfigResponse({ config: DEFAULT_WIDGET_CONFIG })).toEqual(DEFAULT_WIDGET_CONFIG);
    expect(parseConfigResponse({ config: PRO })).toEqual(PRO);
  });

  test("drops extra fields and trims text", () => {
    const parsed = parseConfigResponse({ config: { ...PRO, label: "  Hi  ", secret: "x" }, other: 1 });
    expect(parsed).toEqual({ ...PRO, label: "Hi" });
  });

  test.each<[string, unknown]>([
    ["null", null],
    ["no config", {}],
    ["error body", { error: { code: "not_found", message: "No widget for this key." } }],
    ["bad color", { config: { ...PRO, buttonColor: "red" } }],
    ["color with CSS in it", { config: { ...PRO, buttonColor: "#000;}body{display:none" } }],
    ["3-digit color", { config: { ...PRO, buttonColor: "#fff" } }],
    ["unknown position", { config: { ...PRO, position: "center" } }],
    ["inherited key as position", { config: { ...PRO, position: "toString" } }],
    ["unknown animation", { config: { ...PRO, animation: "spin" } }],
    ["empty label", { config: { ...PRO, label: "   " } }],
    ["long label", { config: { ...PRO, label: "x".repeat(41) } }],
    ["missing header", { config: { ...PRO, headerText: undefined } }],
    ["badge not boolean", { config: { ...PRO, showBadge: "no" } }],
    ["array", [PRO]],
  ])("rejects %s", (_name, body) => {
    expect(parseConfigResponse(body)).toBeNull();
  });

  test("never throws", () => {
    const evil = {
      get config(): never {
        throw new Error("boom");
      },
    };
    expect(parseConfigResponse(evil)).toBeNull();
  });
});

describe("configStyleVars (config → button styles)", () => {
  test("color and readable text color", () => {
    expect(configStyleVars(DEFAULT_WIDGET_CONFIG)).toMatchObject({ "--aw-color": "#0a0a0a", "--aw-text": "#ffffff" });
    expect(configStyleVars({ ...PRO, buttonColor: "#ffee00" })).toMatchObject({ "--aw-text": "#0a0a0a" });
  });

  test.each([
    ["bottom-right", { bottom: "20px", top: "auto", right: "20px", left: "auto" }],
    ["bottom-left", { bottom: "20px", top: "auto", left: "20px", right: "auto" }],
    ["top-right", { top: "20px", bottom: "auto", right: "20px", left: "auto" }],
    ["top-left", { top: "20px", bottom: "auto", left: "20px", right: "auto" }],
  ] as const)("%s puts the button and panel in that corner", (position, sides) => {
    const vars = configStyleVars({ ...PRO, position });
    for (const [side, value] of Object.entries(sides)) {
      expect(vars[`--aw-btn-${side}`]).toBe(value);
      // The panel shares the button's horizontal edge and stacks past it vertically.
      const panel = vars[`--aw-panel-${side}`];
      if (value === "auto") expect(panel).toBe("auto");
      else if (side === "left" || side === "right") expect(panel).toBe("20px");
      else expect(panel).toBe("84px");
    }
    expect(vars["--aw-origin"]).toBe(position.replace("-", " "));
  });

  test("slide comes from the button's side", () => {
    expect(configStyleVars({ ...PRO, position: "bottom-left" })["--aw-slide"]).toBe("16px");
    expect(configStyleVars({ ...PRO, position: "top-left" })["--aw-slide"]).toBe("-16px");
  });
});

test("textColorOn picks the higher-contrast text", () => {
  expect(textColorOn("#000000")).toBe("#ffffff");
  expect(textColorOn("#ffffff")).toBe("#0a0a0a");
  expect(textColorOn("#2563eb")).toBe("#ffffff");
});
