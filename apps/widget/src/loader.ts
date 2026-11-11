import type { WidgetConfig } from "../../../packages/shared/src/widget-config";
import {
  buildEmbedUrl,
  isHttpOrigin,
  isPublicKey,
  parsePanelMessage,
  WIDGET_MESSAGE_SOURCE,
  type LoaderMessage,
  type PanelMessage,
} from "../../../packages/shared/src/widget-messages";
import { configStyleVars, parseConfigResponse } from "./config";
import { STYLES } from "./styles";

/**
 * The loader that runs on the customer's page (project.md §6.5, §9).
 *
 * It imports `widget-messages.ts` and `widget-config.ts` types straight from
 * `packages/shared/src`, never the package index: the index pulls in zod (~460 KB).
 */

/** The one element the widget adds to the page. A custom-element name, so it can host a shadow root without `customElements.define`. */
export const HOST_TAG = "askwell-widget";
export const CONFIG_PATH = "/api/widget/config";
const WARN_PREFIX = "[widget.js]";

export type ScriptSettings = { key: string; appOrigin: string };

/** What the loader touches. Injected so tests can stub fetch and choose the shadow mode. */
export type LoaderEnv = {
  window: Window;
  fetch: typeof fetch;
  warn: (message: string) => void;
  shadowMode: ShadowRootMode;
};

export type MountedWidget = {
  host: HTMLElement;
  /** Exposed for tests; the real page gets a closed root it can't reach. */
  root: ShadowRoot;
  open(): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
};

/** `data-key` and the app origin (from the script's own `src`), or null if either is missing or bad. */
export function readScriptSettings(script: HTMLScriptElement | null): ScriptSettings | null {
  if (!script) return null;
  const key = script.getAttribute("data-key");
  if (!isPublicKey(key)) return null;
  let appOrigin: string;
  try {
    appOrigin = new URL(script.src).origin;
  } catch {
    return null;
  }
  return isHttpOrigin(appOrigin) ? { key, appOrigin } : null;
}

/**
 * The panel message in `event`, or null unless it came from our iframe on the app origin.
 * Both checks are needed: origin alone would trust any app-origin window the page opened,
 * source alone would trust the iframe after it navigated elsewhere.
 */
export function acceptPanelMessage(event: MessageEvent, appOrigin: string, frame: Window | null): PanelMessage | null {
  if (frame === null || event.source !== frame || event.origin !== appOrigin) return null;
  return parsePanelMessage(event.data);
}

/** The plan-applied config for `key`, or null on any network, HTTP or shape error. Never throws. */
export async function fetchConfig(settings: ScriptSettings, env: Pick<LoaderEnv, "fetch">): Promise<WidgetConfig | null> {
  try {
    const url = `${settings.appOrigin}${CONFIG_PATH}?key=${encodeURIComponent(settings.key)}`;
    const res = await env.fetch(url, { method: "GET", credentials: "omit", mode: "cors" });
    if (res.status !== 200) return null;
    return parseConfigResponse(await res.json());
  } catch {
    return null;
  }
}

const CHAT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';

/** Renders the button and wires the panel. Assumes `document.body` exists. */
export function mountWidget(settings: ScriptSettings, config: WidgetConfig, env: LoaderEnv): MountedWidget {
  const win = env.window;
  const doc = win.document;

  const host = doc.createElement(HOST_TAG);
  // Inline !important beats any page rule, so the page can't hide or move the host.
  host.setAttribute("style", "all:initial!important;display:block!important;position:static!important");
  const root = host.attachShadow({ mode: env.shadowMode });

  const style = doc.createElement("style");
  style.textContent = STYLES;

  const wrapper = doc.createElement("div");
  wrapper.className = config.animation;
  for (const [name, value] of Object.entries(configStyleVars(config))) wrapper.style.setProperty(name, value);

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.setAttribute("aria-label", config.label);
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "dialog");
  button.innerHTML = CHAT_ICON; // Fixed markup only; config text below goes in as text.
  const label = doc.createElement("span");
  label.className = "label";
  label.textContent = config.label;
  const badge = doc.createElement("span");
  badge.className = "badge";
  badge.hidden = true;
  badge.setAttribute("aria-hidden", "true");
  button.append(label, badge);

  const panel = doc.createElement("div");
  panel.className = "panel";
  panel.id = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", config.headerText);
  button.setAttribute("aria-controls", panel.id);

  wrapper.append(button, panel);
  root.append(style, wrapper);
  doc.body.append(host);

  let iframe: HTMLIFrameElement | null = null;
  let frameLoaded = false;
  let open = false;

  const post = (type: LoaderMessage["type"]) => {
    // Only ever to the app origin, never "*" (project.md §9).
    if (frameLoaded) iframe?.contentWindow?.postMessage({ source: WIDGET_MESSAGE_SOURCE, type }, settings.appOrigin);
  };

  const ensureFrame = () => {
    if (iframe) return;
    iframe = doc.createElement("iframe");
    iframe.title = config.headerText;
    iframe.src = buildEmbedUrl(settings.appOrigin, settings.key, win.location.origin);
    iframe.addEventListener("load", () => {
      frameLoaded = true;
      post(open ? "opened" : "closed");
    });
    panel.append(iframe);
  };

  const setUnread = (count: number) => {
    badge.hidden = count === 0;
    badge.textContent = count > 9 ? "9+" : String(count);
    button.setAttribute("aria-label", count === 0 ? config.label : `${config.label} (${count} unread)`);
  };

  const openPanel = () => {
    if (open) return;
    ensureFrame();
    open = true;
    wrapper.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    post("opened");
    iframe?.focus();
  };

  const closePanel = () => {
    if (!open) return;
    open = false;
    wrapper.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    post("closed");
    // Focus was in the panel (or nowhere): give it back to the button.
    if (doc.activeElement === host || doc.activeElement === doc.body || doc.activeElement === null) button.focus();
  };

  const onMessage = (event: MessageEvent) => {
    const message = acceptPanelMessage(event, settings.appOrigin, iframe?.contentWindow ?? null);
    if (!message) return;
    switch (message.type) {
      case "close":
        closePanel();
        break;
      case "resize":
        wrapper.style.setProperty("--aw-h", `${message.height}px`);
        break;
      case "unread":
        setUnread(message.count);
        break;
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (open && event.key === "Escape") closePanel();
  };

  button.addEventListener("click", () => (open ? closePanel() : openPanel()));
  win.addEventListener("message", onMessage);
  doc.addEventListener("keydown", onKeyDown);

  return {
    host,
    root,
    open: openPanel,
    close: closePanel,
    isOpen: () => open,
    destroy() {
      win.removeEventListener("message", onMessage);
      doc.removeEventListener("keydown", onKeyDown);
      host.remove();
    },
  };
}

function whenBodyReady(doc: Document): Promise<void> {
  if (doc.body) return Promise.resolve();
  return new Promise((resolve) => doc.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

/**
 * The whole load sequence. Resolves to the mounted widget, or null when nothing should render
 * (no or bad key, config error, already on the page). Never rejects; warns at most once.
 */
export async function startWidget(script: HTMLScriptElement | null, env: LoaderEnv): Promise<MountedWidget | null> {
  try {
    const settings = readScriptSettings(script);
    if (!settings) return null; // No key: do nothing.

    const config = await fetchConfig(settings, env);
    if (!config) {
      env.warn(`${WARN_PREFIX} Couldn't load the widget for this key. Check data-key in the snippet.`);
      return null;
    }

    const doc = env.window.document;
    await whenBodyReady(doc);
    // The snippet pasted twice: keep the first button.
    if (doc.querySelector(HOST_TAG)) return null;
    return mountWidget(settings, config, env);
  } catch {
    env.warn(`${WARN_PREFIX} The widget couldn't start.`);
    return null;
  }
}
