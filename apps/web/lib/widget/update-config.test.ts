import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../supabase/service", () => ({ createServiceClient: vi.fn() }));

const { mergeWidgetConfig, toWidgetConfigRow } = await import("./update-config");
const { toWidgetConfig } = await import("./config");

const ID = "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f";

describe("mergeWidgetConfig", () => {
  it("puts only the sent fields on top of the saved config", () => {
    expect(mergeWidgetConfig(DEFAULT_WIDGET_CONFIG, { animation: "slide" })).toEqual({
      ...DEFAULT_WIDGET_CONFIG,
      animation: "slide",
    });
  });

  it("does not change its input", () => {
    const current = { ...DEFAULT_WIDGET_CONFIG };
    mergeWidgetConfig(current, { label: "Help" });
    expect(current).toEqual(DEFAULT_WIDGET_CONFIG);
  });
});

describe("toWidgetConfigRow", () => {
  it("maps every field, and round-trips through toWidgetConfig", () => {
    const config = {
      buttonColor: "#123abc",
      position: "top-right" as const,
      label: "Help",
      animation: "scale" as const,
      headerText: "Questions?",
      showBadge: true,
    };
    const row = toWidgetConfigRow(ID, config);
    expect(row).toEqual({
      project_id: ID,
      button_color: "#123abc",
      position: "top-right",
      label: "Help",
      animation: "scale",
      header_text: "Questions?",
      show_badge: true,
    });
    expect(toWidgetConfig(row)).toEqual(config);
  });
});
