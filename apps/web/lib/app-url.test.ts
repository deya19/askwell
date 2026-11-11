import { describe, expect, it } from "vitest";
import { requestOrigin, resolveAppUrl } from "./app-url";

const h = (values: Record<string, string>) => new Headers(values);

describe("resolveAppUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL when set, as an origin without a trailing slash", () => {
    const headers = h({ host: "askwell-git-x.vercel.app" });
    expect(resolveAppUrl("https://askwell.example.com", headers)).toBe("https://askwell.example.com");
    expect(resolveAppUrl("https://askwell.example.com/", headers)).toBe("https://askwell.example.com");
    expect(resolveAppUrl(" https://askwell.example.com/app ", headers)).toBe("https://askwell.example.com");
  });

  it("falls back to the request's origin when it isn't set (Vercel previews)", () => {
    const headers = h({ "x-forwarded-host": "askwell-git-x.vercel.app", "x-forwarded-proto": "https" });
    expect(resolveAppUrl(undefined, headers)).toBe("https://askwell-git-x.vercel.app");
    expect(resolveAppUrl("", headers)).toBe("https://askwell-git-x.vercel.app");
  });

  it("ignores a configured value that isn't an http(s) URL", () => {
    const headers = h({ host: "askwell-git-x.vercel.app" });
    expect(resolveAppUrl("not a url", headers)).toBe("https://askwell-git-x.vercel.app");
    expect(resolveAppUrl("javascript:alert(1)", headers)).toBe("https://askwell-git-x.vercel.app");
  });

  it("throws when there's neither", () => {
    expect(() => resolveAppUrl(undefined, h({}))).toThrow("No app URL");
  });
});

describe("requestOrigin", () => {
  it("prefers x-forwarded-host over host, and takes the first of a list", () => {
    expect(requestOrigin(h({ host: "internal:3000", "x-forwarded-host": "a.example.com, b.example.com" }))).toBe(
      "https://a.example.com",
    );
  });

  it("uses x-forwarded-proto, defaulting to https (http for localhost)", () => {
    expect(requestOrigin(h({ host: "a.example.com", "x-forwarded-proto": "http" }))).toBe("http://a.example.com");
    expect(requestOrigin(h({ host: "a.example.com" }))).toBe("https://a.example.com");
    expect(requestOrigin(h({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(requestOrigin(h({ host: "a.example.com", "x-forwarded-proto": "ftp" }))).toBe("https://a.example.com");
  });

  it("rejects hosts that aren't a bare host[:port]", () => {
    expect(requestOrigin(h({ host: "evil.com/path" }))).toBeNull();
    expect(requestOrigin(h({ host: "user@evil.com" }))).toBeNull();
    expect(requestOrigin(h({ host: '"><script>' }))).toBeNull();
    expect(requestOrigin(h({}))).toBeNull();
  });
});
