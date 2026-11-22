import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const connection = vi.fn(async () => {});
vi.mock("next/server", () => ({ connection: () => connection() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-host": "askwell-git-x.vercel.app", "x-forwarded-proto": "https" }),
}));

const { getLandingWidget, landingWidgetFrom } = await import("./landing-widget");

const KEY = "pk_abc123DEF_456";
const h = (values: Record<string, string>) => new Headers(values);

describe("landingWidgetFrom", () => {
  it("points at widget.js on the configured app URL, with the key", () => {
    expect(
      landingWidgetFrom({ LANDING_WIDGET_KEY: KEY, NEXT_PUBLIC_APP_URL: "https://askwell.example.com/" }, h({ host: "x" })),
    ).toEqual({ src: "https://askwell.example.com/widget.js", publicKey: KEY });
  });

  it("falls back to the request's origin (Vercel previews)", () => {
    expect(landingWidgetFrom({ LANDING_WIDGET_KEY: ` ${KEY}\n` }, h({ host: "localhost:3000" }))).toEqual({
      src: "http://localhost:3000/widget.js",
      publicKey: KEY,
    });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["not a public key", "sk_12345678"],
    ["too short", "pk_1"],
  ])("returns null when the key is %s", (_, key) => {
    expect(landingWidgetFrom({ LANDING_WIDGET_KEY: key }, h({ host: "localhost:3000" }))).toBeNull();
  });
});

describe("getLandingWidget", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    connection.mockClear();
  });

  it("reads LANDING_WIDGET_KEY on every request, so a new value needs no rebuild", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("LANDING_WIDGET_KEY", "");
    expect(await getLandingWidget()).toBeNull();

    vi.stubEnv("LANDING_WIDGET_KEY", KEY);
    expect(await getLandingWidget()).toEqual({ src: "https://askwell-git-x.vercel.app/widget.js", publicKey: KEY });

    vi.stubEnv("LANDING_WIDGET_KEY", "pk_otherKey_789");
    expect((await getLandingWidget())?.publicKey).toBe("pk_otherKey_789");

    // Each call opts the render out of the static (build-time) prerender.
    expect(connection).toHaveBeenCalledTimes(3);
  });
});
