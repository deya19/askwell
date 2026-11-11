import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const getWidgetConfigByKey = vi.fn();
vi.mock("../../lib/widget/config", () => ({ getWidgetConfigByKey: (key: string) => getWidgetConfigByKey(key) }));

const { loadEmbed } = await import("./load-embed");

const KEY = "pk_test_abcdefgh1234";
const HOST = "https://customer.example";

beforeEach(() => {
  getWidgetConfigByKey.mockReset();
  getWidgetConfigByKey.mockResolvedValue(DEFAULT_WIDGET_CONFIG);
});

describe("loadEmbed", () => {
  test("valid key and host → ready with the plan-applied config", async () => {
    await expect(loadEmbed({ key: KEY, host: HOST })).resolves.toEqual({
      status: "ready",
      key: KEY,
      host: HOST,
      config: DEFAULT_WIDGET_CONFIG,
    });
    expect(getWidgetConfigByKey).toHaveBeenCalledWith(KEY);
  });

  test("unknown key → unavailable, host kept for close", async () => {
    getWidgetConfigByKey.mockResolvedValue(null);
    await expect(loadEmbed({ key: KEY, host: HOST })).resolves.toEqual({ status: "unavailable", host: HOST });
  });

  test("lookup error → unavailable, never throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getWidgetConfigByKey.mockRejectedValue(new Error("db down"));
    await expect(loadEmbed({ key: KEY, host: HOST })).resolves.toEqual({ status: "unavailable", host: HOST });
  });

  test.each([
    ["no params", {}, null],
    ["bad key, good host", { key: "nope", host: HOST }, HOST],
    ["good key, no host", { key: KEY }, null],
    ["host with a path", { key: KEY, host: `${HOST}/page` }, null],
    ["host *", { key: KEY, host: "*" }, null],
    ["host null (file://)", { key: KEY, host: "null" }, null],
    ["javascript: host", { key: KEY, host: "javascript:alert(1)" }, null],
    ["repeated host", { key: KEY, host: [HOST, "https://evil.example"] }, null],
  ])("%s → unavailable without a lookup", async (_name, params, host) => {
    await expect(loadEmbed(params)).resolves.toEqual({ status: "unavailable", host });
    expect(getWidgetConfigByKey).not.toHaveBeenCalled();
  });
});
