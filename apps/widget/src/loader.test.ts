// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_WIDGET_CONFIG, type WidgetConfig } from "../../../packages/shared/src/widget-config";
import { WIDGET_MESSAGE_SOURCE } from "../../../packages/shared/src/widget-messages";
import {
  acceptPanelMessage,
  HOST_TAG,
  mountWidget,
  readScriptSettings,
  startWidget,
  type LoaderEnv,
  type MountedWidget,
} from "./loader";

const APP = "https://app.askwell.test";
const KEY = "pk_test_abcdefgh1234";
const CONFIG: WidgetConfig = { ...DEFAULT_WIDGET_CONFIG, animation: "scale", position: "top-left", label: "Help" };

function script(attrs: Record<string, string>): HTMLScriptElement {
  const el = document.createElement("script");
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

function env(fetchImpl: typeof fetch) {
  return { window, fetch: fetchImpl, warn: vi.fn<LoaderEnv["warn"]>(), shadowMode: "open" } satisfies LoaderEnv;
}

const okFetch = (body: unknown = { config: CONFIG }) => vi.fn<typeof fetch>(async () => Response.json(body));

let mounted: MountedWidget | null = null;
afterEach(() => {
  mounted?.destroy();
  mounted = null;
  document.body.innerHTML = "";
});

describe("readScriptSettings", () => {
  test("takes the key and the origin of the script's src", () => {
    expect(readScriptSettings(script({ src: `${APP}/widget.js?v=1`, "data-key": KEY }))).toEqual({ key: KEY, appOrigin: APP });
  });

  test.each([
    ["no script", null],
    ["no key", script({ src: `${APP}/widget.js` })],
    ["bad key", script({ src: `${APP}/widget.js`, "data-key": "nope" })],
    ["non-http src", script({ src: "data:text/javascript,1", "data-key": KEY })],
  ])("null for %s", (_name, el) => {
    expect(readScriptSettings(el)).toBeNull();
  });
});

describe("startWidget", () => {
  test("renders one button with the config label in a shadow root", async () => {
    const fetchMock = okFetch();
    mounted = await startWidget(script({ src: `${APP}/widget.js`, "data-key": KEY }), env(fetchMock));
    expect(fetchMock).toHaveBeenCalledWith(`${APP}/api/widget/config?key=${KEY}`, expect.objectContaining({ credentials: "omit" }));
    expect(document.querySelectorAll(HOST_TAG)).toHaveLength(1);
    const button = mounted!.root.querySelector("button")!;
    expect(button.getAttribute("aria-label")).toBe("Help");
    expect(button.textContent).toBe("Help");
    // Nothing but the host element is added to the page itself.
    expect(document.body.children).toHaveLength(1);
    expect(document.head.querySelector("style")).toBeNull();
  });

  test("no key: no fetch, nothing rendered, no warning", async () => {
    const e = env(okFetch());
    expect(await startWidget(script({ src: `${APP}/widget.js` }), e)).toBeNull();
    expect(e.fetch).not.toHaveBeenCalled();
    expect(e.warn).not.toHaveBeenCalled();
    expect(document.querySelector(HOST_TAG)).toBeNull();
  });

  test.each<[string, typeof fetch]>([
    ["404 (unknown key)", async () => Response.json({ error: { code: "not_found", message: "x" } }, { status: 404 })],
    ["500", async () => new Response("oops", { status: 500 })],
    ["network error", async () => Promise.reject(new TypeError("Failed to fetch"))],
    ["non-JSON 200", async () => new Response("<html>", { status: 200 })],
    ["bad config", async () => Response.json({ config: { ...CONFIG, buttonColor: "red" } })],
  ])("bad key / %s: nothing rendered, one warning, no throw", async (_name, fetchImpl) => {
    const e = env(vi.fn(fetchImpl));
    await expect(startWidget(script({ src: `${APP}/widget.js`, "data-key": KEY }), e)).resolves.toBeNull();
    expect(document.querySelector(HOST_TAG)).toBeNull();
    expect(e.warn).toHaveBeenCalledTimes(1);
  });

  test("the snippet pasted twice renders one button", async () => {
    const el = script({ src: `${APP}/widget.js`, "data-key": KEY });
    mounted = await startWidget(el, env(okFetch()));
    expect(await startWidget(el, env(okFetch()))).toBeNull();
    expect(document.querySelectorAll(HOST_TAG)).toHaveLength(1);
  });
});

describe("panel", () => {
  function mount() {
    mounted = mountWidget({ key: KEY, appOrigin: APP }, CONFIG, env(okFetch()));
    const root = mounted.root;
    return {
      root,
      button: root.querySelector("button")!,
      badge: root.querySelector<HTMLElement>(".badge")!,
      wrapper: root.querySelector<HTMLElement>("div")!,
    };
  }

  test("click opens an iframe at the embed URL with the configured animation", () => {
    const { root, button, wrapper } = mount();
    expect(root.querySelector("iframe")).toBeNull(); // Loaded on first open only.
    button.click();
    const iframe = root.querySelector("iframe")!;
    const url = new URL(iframe.src);
    expect(url.origin + url.pathname).toBe(`${APP}/embed`);
    expect(url.searchParams.get("key")).toBe(KEY);
    expect(url.searchParams.get("host")).toBe(window.location.origin);
    expect(wrapper.classList.contains("scale")).toBe(true);
    expect(wrapper.classList.contains("open")).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    button.click();
    expect(mounted!.isOpen()).toBe(false);
  });

  test("Escape closes the panel", () => {
    const { button } = mount();
    button.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(mounted!.isOpen()).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  /** Clicks open and gives the iframe a stand-in window (happy-dom doesn't create one). */
  function openWithFrame(root: ShadowRoot, button: HTMLButtonElement) {
    button.click();
    const iframe = root.querySelector("iframe")!;
    const frame = { postMessage: vi.fn() } as unknown as Window & { postMessage: ReturnType<typeof vi.fn> };
    Object.defineProperty(iframe, "contentWindow", { value: frame });
    return { iframe, frame };
  }

  function fromPanel(frame: Window | null, origin: string, data: unknown) {
    window.dispatchEvent(new MessageEvent("message", { data, origin, source: frame }));
  }

  test("handles close, resize and unread from the panel", () => {
    const { root, button, badge, wrapper } = mount();
    const { frame } = openWithFrame(root, button);

    fromPanel(frame, APP, { source: WIDGET_MESSAGE_SOURCE, type: "resize", height: 420 });
    expect(wrapper.style.getPropertyValue("--aw-h")).toBe("420px");

    fromPanel(frame, APP, { source: WIDGET_MESSAGE_SOURCE, type: "close" });
    expect(mounted!.isOpen()).toBe(false);

    fromPanel(frame, APP, { source: WIDGET_MESSAGE_SOURCE, type: "unread", count: 3 });
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe("3");
    expect(button.getAttribute("aria-label")).toBe("Help (3 unread)");

    fromPanel(frame, APP, { source: WIDGET_MESSAGE_SOURCE, type: "unread", count: 0 });
    expect(badge.hidden).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("Help");
  });

  test("ignores messages from another origin, another window, or before the iframe exists", () => {
    const { root, button, badge } = mount();
    const unread = { source: WIDGET_MESSAGE_SOURCE, type: "unread", count: 5 };

    fromPanel(window, APP, unread); // No iframe yet.
    expect(badge.hidden).toBe(true);

    const { frame } = openWithFrame(root, button);
    fromPanel(frame, "https://evil.test", unread);
    fromPanel(frame, "https://app.askwell.test.evil.test", unread);
    fromPanel(frame, "null", unread);
    fromPanel(window, APP, unread); // Right origin, wrong window.
    fromPanel(frame, APP, { ...unread, source: "other" });
    fromPanel(frame, "https://evil.test", { source: WIDGET_MESSAGE_SOURCE, type: "close" });
    expect(badge.hidden).toBe(true);
    expect(mounted!.isOpen()).toBe(true);
  });

  test("posts opened/closed to the iframe with the app origin, never *", () => {
    const { root, button } = mount();
    const { iframe, frame } = openWithFrame(root, button);
    expect(frame.postMessage).not.toHaveBeenCalled(); // Not loaded yet.
    iframe.dispatchEvent(new Event("load"));
    button.click();
    expect(frame.postMessage.mock.calls).toEqual([
      [{ source: WIDGET_MESSAGE_SOURCE, type: "opened" }, APP],
      [{ source: WIDGET_MESSAGE_SOURCE, type: "closed" }, APP],
    ]);
  });
});

describe("acceptPanelMessage", () => {
  const frame = {} as Window;
  const data = { source: WIDGET_MESSAGE_SOURCE, type: "close" };
  const event = (origin: string, source: unknown, payload: unknown = data) =>
    ({ origin, source, data: payload }) as unknown as MessageEvent;

  test("accepts our message from our frame on the app origin", () => {
    expect(acceptPanelMessage(event(APP, frame), APP, frame)).toEqual(data);
  });

  test.each([
    ["other origin", event("https://evil.test", frame), frame],
    ["app origin with a trailing slash", event(`${APP}/`, frame), frame],
    ["other source", event(APP, {}), frame],
    ["no frame yet", event(APP, null), null],
    ["not our message", event(APP, frame, { type: "close" }), frame],
  ] as const)("rejects %s", (_name, e, f) => {
    expect(acceptPanelMessage(e, APP, f)).toBeNull();
  });
});
