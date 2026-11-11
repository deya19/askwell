import { PUBLIC_KEY_PREFIX } from "./limits";

/**
 * The postMessage protocol between the loader (widget.js on the customer's page)
 * and the panel (/embed, inside the iframe). project.md §6.5, §9.
 *
 * Plain type guards, no zod: the loader bundles this file, and importing zod
 * there adds ~460 KB minified (zod/mini still ~6 KB gzipped). One implementation
 * serves both sides, so loader and panel can't drift apart.
 *
 * The loader must import this file directly, not `@askwell/shared` (the index
 * pulls in zod through the other modules). Keep it free of zod, browser globals
 * and other imports beyond `./limits`.
 *
 * Origin checks come first and are the caller's job: the loader accepts messages
 * only from the app origin, the panel only from `host` (see `parseEmbedParams`).
 * These parsers then make sure the data itself is ours and well-formed.
 */

/**
 * Tag on every message, so both sides ignore unrelated postMessage traffic.
 * Fixed on purpose (not APP_NAME): installed loaders must keep working if the app is renamed.
 */
export const WIDGET_MESSAGE_SOURCE = "askwell";
export type WidgetMessageSource = typeof WIDGET_MESSAGE_SOURCE;

/** Bounds for the panel height the panel may ask for, in CSS px. */
export const PANEL_HEIGHT_MIN = 200;
export const PANEL_HEIGHT_MAX = 800;

type Tagged<T extends string, Fields = unknown> = { source: WidgetMessageSource; type: T } & Fields;

// ---------------------------------------------------------------------------
// Panel → loader
// ---------------------------------------------------------------------------

export type PanelMessage =
  /** The visitor closed the panel from inside it. */
  | Tagged<"close">
  /** The panel wants this height (PANEL_HEIGHT_MIN–MAX). The loader may still cap it to the viewport. */
  | Tagged<"resize", { height: number }>
  /** Bot replies the visitor hasn't seen (panel closed). 0 clears the badge. */
  | Tagged<"unread", { count: number }>;
export type PanelMessageType = PanelMessage["type"];
export const PANEL_MESSAGE_TYPES = ["close", "resize", "unread"] as const satisfies readonly PanelMessageType[];

// ---------------------------------------------------------------------------
// Loader → panel
// ---------------------------------------------------------------------------

export type LoaderMessage =
  /** The panel became visible: replies now count as seen. */
  | Tagged<"opened">
  /** The panel was hidden: new replies count as unread. */
  | Tagged<"closed">;
export type LoaderMessageType = LoaderMessage["type"];
export const LOADER_MESSAGE_TYPES = ["opened", "closed"] as const satisfies readonly LoaderMessageType[];

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}

/** The message's type if it carries our tag, else null. */
function taggedType(data: Record<string, unknown>): string | null {
  return data.source === WIDGET_MESSAGE_SOURCE && typeof data.type === "string" ? data.type : null;
}

/**
 * Runs a parser and turns any throw into null. Structured-cloned postMessage
 * data can't throw, but a same-realm caller could pass a Proxy or a getter.
 */
function neverThrow<T>(data: unknown, parse: (data: Record<string, unknown>) => T | null): T | null {
  try {
    return isRecord(data) ? parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * The typed panel → loader message, or null for anything else. Never throws.
 * Returns a fresh object with only the known fields; extra fields are dropped.
 */
export function parsePanelMessage(data: unknown): PanelMessage | null {
  return neverThrow<PanelMessage>(data, (fields) => {
    const type = taggedType(fields);
    const source = WIDGET_MESSAGE_SOURCE;
    switch (type) {
      case "close":
        return { source, type };
      case "resize": {
        const height = fields.height;
        return isIntInRange(height, PANEL_HEIGHT_MIN, PANEL_HEIGHT_MAX) ? { source, type, height } : null;
      }
      case "unread": {
        const count = fields.count;
        return isIntInRange(count, 0, Number.MAX_SAFE_INTEGER) ? { source, type, count } : null;
      }
      default:
        return null;
    }
  });
}

/** The typed loader → panel message, or null for anything else. Never throws. */
export function parseLoaderMessage(data: unknown): LoaderMessage | null {
  return neverThrow<LoaderMessage>(data, (fields) => {
    const type = taggedType(fields);
    return type === "opened" || type === "closed" ? { source: WIDGET_MESSAGE_SOURCE, type } : null;
  });
}

// ---------------------------------------------------------------------------
// /embed URL
// ---------------------------------------------------------------------------

export const EMBED_PATH = "/embed";

/**
 * The WHATWG `URL` global (Node, browsers, workers, edge). Typed here because
 * this package compiles without DOM or Node types; module-scoped, so it doesn't
 * clash where those types exist.
 */
declare const URL: new (url: string, base?: string) => {
  readonly protocol: string;
  readonly origin: string;
  readonly searchParams: { set(name: string, value: string): void };
  toString(): string;
};

const MAX_ORIGIN_LENGTH = 2048;

/** Same rule as `publicKeySchema` (api/common.ts); a test keeps them in step. */
const PUBLIC_KEY_PATTERN = new RegExp(`^${PUBLIC_KEY_PREFIX}[A-Za-z0-9_-]{8,128}$`);

export function isPublicKey(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_KEY_PATTERN.test(value);
}

/**
 * True for an exact http(s) origin: scheme, host and optional port only, in the
 * canonical form `URL.origin` gives (lowercase, no default port, no trailing slash).
 * Rejects paths, queries, credentials, `*`, `null` and other schemes such as `javascript:`.
 */
export function isHttpOrigin(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_ORIGIN_LENGTH) return false;
  let url: InstanceType<typeof URL>;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
}

/**
 * Query params of the /embed URL. The panel uses `host` as its postMessage
 * targetOrigin and as the only origin it accepts messages from. Never `*`.
 */
export type EmbedParams = { key: string; host: string };

/** `URLSearchParams` (typed structurally), or a Next.js `searchParams` object. */
type SearchParamsLike = { getAll(name: string): string[] };
type ParamSource = SearchParamsLike | Record<string, string | string[] | undefined>;

function hasGetAll(params: ParamSource): params is SearchParamsLike {
  return typeof (params as Partial<SearchParamsLike>).getAll === "function";
}

function readParam(params: ParamSource, name: string): string | undefined {
  // A repeated param (`?host=a&host=b`) is ambiguous, so it's rejected, not guessed.
  if (hasGetAll(params)) {
    const all = params.getAll(name);
    return all.length === 1 ? all[0] : undefined;
  }
  const value = params[name];
  return typeof value === "string" ? value : undefined;
}

/** The validated /embed params, or null if `key` or `host` is missing or bad. Never throws. */
export function parseEmbedParams(params: ParamSource): EmbedParams | null {
  try {
    const key = readParam(params, "key");
    const host = readParam(params, "host");
    return isPublicKey(key) && isHttpOrigin(host) ? { key, host } : null;
  } catch {
    return null;
  }
}

/**
 * The iframe URL the loader opens: `<appOrigin>/embed?key=…&host=…`.
 * `hostOrigin` is the host page's `location.origin`. Nothing is validated here;
 * the panel runs `parseEmbedParams` and renders nothing on bad params (for
 * example a page opened from `file://`, whose origin is `null`).
 */
export function buildEmbedUrl(appOrigin: string, key: string, hostOrigin: string): string {
  const url = new URL(EMBED_PATH, appOrigin);
  url.searchParams.set("key", key);
  url.searchParams.set("host", hostOrigin);
  return url.toString();
}
