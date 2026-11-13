import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProtectResult } from "../../../../lib/arcjet/decision";

vi.mock("server-only", () => ({}));

const KEY = "pk_0123456789abcdef0123456789abcdef";

const savedRow = {
  project_id: "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f",
  button_color: "#ff5500",
  position: "top-left",
  label: "Chat with us",
  animation: "slide",
  header_text: "Hi there",
  show_badge: false,
};

type Result = {
  data: { widget_configs: typeof savedRow | null; accounts: { plan: string } } | null;
  error: { message: string } | null;
};
let result: Result = { data: null, error: null };

const query = {
  select: vi.fn(() => query),
  eq: vi.fn(() => query),
  maybeSingle: vi.fn(async () => result),
};
const from = vi.fn(() => query);
const createServiceClient = vi.fn(() => ({ from }));
vi.mock("../../../../lib/supabase/service", () => ({ createServiceClient }));

const protectWidgetConfig = vi.fn<(request: Request) => Promise<ProtectResult>>(async () => ({ allowed: true }));
vi.mock("../../../../lib/arcjet/config", () => ({ protectWidgetConfig }));

const { GET, OPTIONS } = await import("./route");

const get = (search: string) => GET(new Request(`http://localhost/api/widget/config${search}`));

function expectCors(res: Response) {
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
  expect(res.headers.get("access-control-allow-credentials")).toBeNull();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  result = { data: { widget_configs: savedRow, accounts: { plan: "free" } }, error: null };
});

describe("GET /api/widget/config", () => {
  it("returns the defaults with the badge on for a Free owner, whatever is saved", async () => {
    const res = await get(`?key=${KEY}`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ config: { ...DEFAULT_WIDGET_CONFIG, showBadge: true } });
  });

  it("returns the saved config for a Pro owner", async () => {
    result = { data: { widget_configs: savedRow, accounts: { plan: "pro" } }, error: null };

    const res = await get(`?key=${KEY}`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      config: {
        buttonColor: "#ff5500",
        position: "top-left",
        label: "Chat with us",
        animation: "slide",
        headerText: "Hi there",
        showBadge: false,
      },
    });
  });

  it("looks the project up by public key only, with the service client", async () => {
    await get(`?key=${KEY}`);

    expect(from).toHaveBeenCalledWith("projects");
    expect(query.eq).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenCalledWith("public_key", KEY);
    expect(query.select).toHaveBeenCalledWith("widget_configs(*), accounts(plan)");
  });

  it("returns only the config: no project id, name or owner", async () => {
    result = { data: { widget_configs: savedRow, accounts: { plan: "pro" } }, error: null };

    const body = await (await get(`?key=${KEY}`)).json();

    expect(Object.keys(body)).toEqual(["config"]);
    expect(JSON.stringify(body)).not.toContain(savedRow.project_id);
    expect(JSON.stringify(body)).not.toMatch(/owner|plan|"id"|"name"/);
  });

  it("sends CORS headers and a short public cache", async () => {
    const res = await get(`?key=${KEY}`);

    expectCors(res);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("returns 404 not_found for an unknown key, with CORS and no caching", async () => {
    result = { data: null, error: null };

    const res = await get(`?key=${KEY}`);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "not_found" } });
    expectCors(res);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["no key", ""],
    ["an empty key", "?key="],
    ["a key without pk_", "?key=sk_0123456789abcdef"],
    ["a key that's too short", "?key=pk_abc"],
    ["a key with bad characters", "?key=pk_0123456789%3Cscript%3E"],
  ])("returns 400 invalid_request for %s, without a query", async (_label, search) => {
    const res = await get(search);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "invalid_request" } });
    expectCors(res);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 500 without details on a database error", async () => {
    result = { data: null, error: { message: "secret detail" } };

    const res = await get(`?key=${KEY}`);

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    expectCors(res);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("checks Arcjet once per request", async () => {
    await get(`?key=${KEY}`);

    expect(protectWidgetConfig).toHaveBeenCalledOnce();
  });

  it("returns 429 rate_limited with CORS and no caching when Arcjet rate limits, without a query", async () => {
    protectWidgetConfig.mockResolvedValueOnce({ allowed: false, reason: "rate_limit" });

    const res = await get(`?key=${KEY}`);

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "rate_limited" } });
    expectCors(res);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 403 forbidden with CORS when Arcjet blocks for another reason", async () => {
    protectWidgetConfig.mockResolvedValueOnce({ allowed: false, reason: "shield" });

    const res = await get(`?key=${KEY}`);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
    expectCors(res);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 500 for an unknown plan instead of guessing one", async () => {
    result = { data: { widget_configs: savedRow, accounts: { plan: "enterprise" } }, error: null };

    const res = await get(`?key=${KEY}`);

    expect(res.status).toBe(500);
  });
});

describe("OPTIONS /api/widget/config", () => {
  it("answers the preflight for any origin", () => {
    const res = OPTIONS();

    expect(res.status).toBe(204);
    expectCors(res);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
