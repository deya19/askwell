import { DEFAULT_WIDGET_CONFIG, type WidgetConfig } from "@askwell/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveWidgetConfig } from "./api";
import { cornerSides, customizePath, isDirty, previewConfig, textColorOn, validateDraft } from "./copy";

const PRO: WidgetConfig = {
  buttonColor: "#ff6600",
  position: "top-left",
  label: "Need help?",
  animation: "slide",
  headerText: "Support",
  showBadge: false,
};

describe("customizePath", () => {
  it("encodes the id", () => {
    expect(customizePath("abc")).toBe("/dashboard/projects/abc/customize");
    expect(customizePath("a/b")).toBe("/dashboard/projects/a%2Fb/customize");
  });
});

describe("validateDraft", () => {
  it("accepts a valid config and trims text", () => {
    expect(validateDraft({ ...PRO, label: "  Hi  " })).toEqual({ ok: true, config: { ...PRO, label: "Hi" } });
  });

  it("gives one message per bad field", () => {
    const result = validateDraft({ ...PRO, buttonColor: "#ff66", label: "   ", headerText: "x".repeat(81) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["buttonColor", "headerText", "label"]);
    expect(result.errors.buttonColor).toMatch(/hex color/);
    expect(result.errors.label).toMatch(/label/);
  });

  it("refuses an unknown position or animation", () => {
    const bad = { ...PRO, position: "center", animation: "spin" } as unknown as WidgetConfig;
    const result = validateDraft(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["animation", "position"]);
  });
});

describe("previewConfig", () => {
  it("shows the draft while it is valid", () => {
    expect(previewConfig(PRO, DEFAULT_WIDGET_CONFIG)).toEqual(PRO);
  });

  it("keeps the last good value for a half-typed field", () => {
    const draft = { ...PRO, buttonColor: "#ff6", label: "" };
    expect(previewConfig(draft, DEFAULT_WIDGET_CONFIG)).toEqual({
      ...PRO,
      buttonColor: DEFAULT_WIDGET_CONFIG.buttonColor,
      label: DEFAULT_WIDGET_CONFIG.label,
    });
  });
});

describe("isDirty", () => {
  it("is false for the same config, ignoring color case and outer spaces", () => {
    expect(isDirty(PRO, PRO)).toBe(false);
    expect(isDirty({ ...PRO, buttonColor: "#FF6600", label: " Need help? " }, PRO)).toBe(false);
  });

  it("is true when any field changes", () => {
    expect(isDirty({ ...PRO, position: "bottom-right" }, PRO)).toBe(true);
    expect(isDirty({ ...PRO, showBadge: true }, PRO)).toBe(true);
    expect(isDirty({ ...PRO, headerText: "Help" }, PRO)).toBe(true);
  });
});

describe("preview helpers", () => {
  it("textColorOn matches the loader's rule", () => {
    expect(textColorOn("#000000")).toBe("#ffffff");
    expect(textColorOn("#ffffff")).toBe("#0a0a0a");
    expect(textColorOn("#2563eb")).toBe("#ffffff");
    expect(textColorOn("#ffee00")).toBe("#0a0a0a");
  });

  it.each([
    ["top-left", "top", "left"],
    ["top-right", "top", "right"],
    ["bottom-left", "bottom", "left"],
    ["bottom-right", "bottom", "right"],
  ] as const)("cornerSides(%s)", (position, vertical, horizontal) => {
    expect(cornerSides(position)).toEqual({ vertical, horizontal });
  });
});

describe("saveWidgetConfig", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Response | Error) {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("PATCHes the project's config route and returns the saved config", async () => {
    const fetchMock = stubFetch(Response.json({ config: PRO }));
    const result = await saveWidgetConfig("p 1", PRO);

    expect(result).toEqual({ ok: true, data: { config: PRO } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/projects/p%201/config");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual(PRO);
  });

  it("returns plan_required on 402, so the page can show the upgrade prompt", async () => {
    stubFetch(
      Response.json(
        { error: { code: "plan_required", message: "Customizing the widget needs the Pro plan." } },
        { status: 402 },
      ),
    );
    expect(await saveWidgetConfig("p1", PRO)).toEqual({
      ok: false,
      code: "plan_required",
      message: "Customizing the widget needs the Pro plan.",
    });
  });

  it("passes other errors through", async () => {
    stubFetch(Response.json({ error: { code: "invalid_request", message: "Bad color." } }, { status: 400 }));
    expect(await saveWidgetConfig("p1", PRO)).toMatchObject({ ok: false, code: "invalid_request", message: "Bad color." });
  });

  it("turns a network failure into network_error", async () => {
    stubFetch(new TypeError("offline"));
    expect(await saveWidgetConfig("p1", PRO)).toMatchObject({ ok: false, code: "network_error" });
  });

  it("treats a 200 with a bad body as an error", async () => {
    stubFetch(Response.json({ config: { ...PRO, buttonColor: "red" } }));
    expect(await saveWidgetConfig("p1", PRO)).toMatchObject({ ok: false, code: "internal_error" });
  });
});
