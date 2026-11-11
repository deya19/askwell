import { describe, expect, it } from "vitest";
import { publicKeySchema } from "./api/common";
import {
  buildEmbedUrl,
  isHttpOrigin,
  isPublicKey,
  PANEL_HEIGHT_MAX,
  PANEL_HEIGHT_MIN,
  parseEmbedParams,
  parseLoaderMessage,
  parsePanelMessage,
  WIDGET_MESSAGE_SOURCE,
} from "./widget-messages";

// Test runtime globals; this package compiles without DOM or Node types.
type TestSearchParams = {
  get(name: string): string | null;
  getAll(name: string): string[];
  keys(): IterableIterator<string>;
};
declare const URL: new (url: string) => { origin: string; pathname: string; searchParams: TestSearchParams };
declare const URLSearchParams: new (init: string | Record<string, string>) => TestSearchParams;

const source = WIDGET_MESSAGE_SOURCE;
const KEY = "pk_abc123DEF_456";

describe("WIDGET_MESSAGE_SOURCE", () => {
  it("is the fixed tag installed loaders rely on", () => {
    expect(WIDGET_MESSAGE_SOURCE).toBe("askwell");
  });
});

describe("parsePanelMessage", () => {
  it("accepts close", () => {
    expect(parsePanelMessage({ source, type: "close" })).toEqual({ source, type: "close" });
  });

  it("accepts resize within bounds", () => {
    for (const height of [PANEL_HEIGHT_MIN, 480, PANEL_HEIGHT_MAX]) {
      expect(parsePanelMessage({ source, type: "resize", height })).toEqual({ source, type: "resize", height });
    }
  });

  it("rejects resize out of bounds or not an integer", () => {
    for (const height of [PANEL_HEIGHT_MIN - 1, PANEL_HEIGHT_MAX + 1, 300.5, Number.NaN, Infinity, "400", undefined]) {
      expect(parsePanelMessage({ source, type: "resize", height })).toBeNull();
    }
  });

  it("accepts unread with a non-negative integer count", () => {
    expect(parsePanelMessage({ source, type: "unread", count: 0 })).toEqual({ source, type: "unread", count: 0 });
    expect(parsePanelMessage({ source, type: "unread", count: 3 })).toEqual({ source, type: "unread", count: 3 });
  });

  it("rejects unread with a bad count", () => {
    for (const count of [-1, 1.5, "2", null, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parsePanelMessage({ source, type: "unread", count })).toBeNull();
    }
  });

  it("rejects a wrong or missing source tag", () => {
    expect(parsePanelMessage({ source: "Askwell", type: "close" })).toBeNull();
    expect(parsePanelMessage({ source: "other-widget", type: "close" })).toBeNull();
    expect(parsePanelMessage({ type: "close" })).toBeNull();
  });

  it("rejects unknown types, loader messages and non-objects", () => {
    for (const data of [
      { source, type: "open" },
      { source, type: "opened" },
      { source, type: "toString" },
      { source },
      null,
      undefined,
      "close",
      42,
      [source, "close"],
      JSON.stringify({ source, type: "close" }),
    ]) {
      expect(parsePanelMessage(data)).toBeNull();
    }
  });

  it("returns a fresh object with only the known fields", () => {
    const data = { source, type: "resize", height: 400, html: "<img onerror=alert(1)>" };
    const message = parsePanelMessage(data);
    expect(message).toEqual({ source, type: "resize", height: 400 });
    expect(message).not.toBe(data);
  });

  it("never throws, even on a throwing getter or a revoked Proxy", () => {
    const throwing = Object.defineProperty({ source }, "type", {
      get() {
        throw new Error("boom");
      },
    });
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    for (const data of [throwing, proxy]) {
      expect(() => parsePanelMessage(data)).not.toThrow();
      expect(parsePanelMessage(data)).toBeNull();
      expect(parseLoaderMessage(data)).toBeNull();
    }
  });
});

describe("parseLoaderMessage", () => {
  it("accepts opened and closed", () => {
    expect(parseLoaderMessage({ source, type: "opened" })).toEqual({ source, type: "opened" });
    expect(parseLoaderMessage({ source, type: "closed" })).toEqual({ source, type: "closed" });
  });

  it("rejects a wrong source tag, panel messages and junk", () => {
    for (const data of [
      { source: "x", type: "opened" },
      { type: "opened" },
      { source, type: "close" },
      { source, type: "resize", height: 400 },
      null,
      "opened",
    ]) {
      expect(parseLoaderMessage(data)).toBeNull();
    }
  });
});

describe("isHttpOrigin", () => {
  it("accepts exact http(s) origins", () => {
    for (const host of ["https://example.com", "http://localhost:3000", "https://shop.example.co.uk:8443", "http://127.0.0.1:8080"]) {
      expect(isHttpOrigin(host)).toBe(true);
    }
  });

  it("rejects anything that isn't an exact http(s) origin", () => {
    for (const host of [
      "*",
      "null",
      "",
      "javascript:alert(1)",
      "javascript://example.com",
      "data:text/html,hi",
      "file:///etc/passwd",
      "ftp://example.com",
      "https://example.com/",
      "https://example.com/path",
      "https://example.com?x=1",
      "https://example.com#x",
      "https://user:pass@example.com",
      "HTTPS://EXAMPLE.COM",
      "https://example.com:443",
      "example.com",
      " https://example.com",
      `https://${"a".repeat(2050)}.com`,
      null,
      42,
    ]) {
      expect(isHttpOrigin(host)).toBe(false);
    }
  });
});

describe("isPublicKey", () => {
  it("agrees with publicKeySchema", () => {
    for (const key of [KEY, "pk_12345678", `pk_${"a".repeat(128)}`, `pk_${"a".repeat(129)}`, "pk_1234567", "sk_12345678", "pk_abc def12", "", " pk_12345678"]) {
      expect(isPublicKey(key)).toBe(publicKeySchema.safeParse(key).success);
    }
  });
});

describe("parseEmbedParams", () => {
  it("accepts a valid key and host from URLSearchParams or a plain object", () => {
    const expected = { key: KEY, host: "https://example.com" };
    expect(parseEmbedParams(new URLSearchParams(expected))).toEqual(expected);
    expect(parseEmbedParams(expected)).toEqual(expected);
  });

  it("rejects a host with a path, *, or a javascript: URL", () => {
    for (const host of ["https://example.com/path", "*", "javascript:alert(1)"]) {
      expect(parseEmbedParams(new URLSearchParams({ key: KEY, host }))).toBeNull();
      expect(parseEmbedParams({ key: KEY, host })).toBeNull();
    }
  });

  it("rejects a bad or missing key, a missing host, and repeated params", () => {
    expect(parseEmbedParams({ key: "sk_live_123456789", host: "https://example.com" })).toBeNull();
    expect(parseEmbedParams({ host: "https://example.com" })).toBeNull();
    expect(parseEmbedParams({ key: KEY })).toBeNull();
    expect(parseEmbedParams({ key: KEY, host: ["https://a.com", "https://b.com"] })).toBeNull();
    expect(parseEmbedParams(new URLSearchParams(`key=${KEY}&host=https://a.com&host=https://b.com`))).toBeNull();
  });
});

describe("buildEmbedUrl", () => {
  it("round-trips key and host through parseEmbedParams", () => {
    const url = new URL(buildEmbedUrl("https://app.example.com", KEY, "https://customer.example.org:8443"));
    expect(url.origin).toBe("https://app.example.com");
    expect(url.pathname).toBe("/embed");
    expect(parseEmbedParams(url.searchParams)).toEqual({ key: KEY, host: "https://customer.example.org:8443" });
  });

  it("ignores a path on the app origin and encodes the params", () => {
    const url = new URL(buildEmbedUrl("https://app.example.com/some/page?x=1", KEY, "http://localhost:3000"));
    expect(url.pathname).toBe("/embed");
    expect([...url.searchParams.keys()]).toEqual(["key", "host"]);
    expect(url.searchParams.get("host")).toBe("http://localhost:3000");
  });

  it("produces a URL the panel rejects for a file:// page (origin null)", () => {
    const url = new URL(buildEmbedUrl("https://app.example.com", KEY, "null"));
    expect(parseEmbedParams(url.searchParams)).toBeNull();
  });
});
