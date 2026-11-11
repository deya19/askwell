import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let result: { data: unknown; error: { message: string } | null } = { data: null, error: null };
const query = {
  select: vi.fn(() => query),
  eq: vi.fn(() => query),
  maybeSingle: vi.fn(async () => result),
};
vi.mock("../supabase/service", () => ({ createServiceClient: () => ({ from: () => query }) }));

const { getWidgetConfigByKey, toWidgetConfig } = await import("./config");

const row = {
  project_id: "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f",
  button_color: "#123abc",
  position: "bottom-left",
  label: "Help",
  animation: "scale",
  header_text: "Questions?",
  show_badge: true,
};

beforeEach(() => {
  result = { data: null, error: null };
});

describe("toWidgetConfig", () => {
  it("maps a row to camelCase", () => {
    expect(toWidgetConfig(row)).toEqual({
      buttonColor: "#123abc",
      position: "bottom-left",
      label: "Help",
      animation: "scale",
      headerText: "Questions?",
      showBadge: true,
    });
  });

  it("throws on a value outside the schema", () => {
    expect(() => toWidgetConfig({ ...row, position: "middle" })).toThrow();
  });
});

describe("getWidgetConfigByKey", () => {
  it("returns null for an unknown key", async () => {
    await expect(getWidgetConfigByKey("pk_0123456789abcdef")).resolves.toBeNull();
  });

  it("falls back to the defaults when a Pro project has no config row", async () => {
    result = { data: { widget_configs: null, accounts: { plan: "pro" } }, error: null };
    await expect(getWidgetConfigByKey("pk_0123456789abcdef")).resolves.toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("throws on a database error", async () => {
    result = { data: null, error: { message: "boom" } };
    await expect(getWidgetConfigByKey("pk_0123456789abcdef")).rejects.toThrow("Could not load widget config: boom");
  });
});
