import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { autoImplementMethods } from "next/dist/server/route-modules/app-route/helpers/auto-implement-methods";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * CORS rules (project.md §9): public widget routes allow any origin; owner routes, the Clerk
 * webhook and the PostHog config route send no CORS headers, so a foreign site can't read them.
 */

vi.mock("server-only", () => ({}));

// Every owner route runs signed out: the request a foreign site's script would send.
vi.mock("../auth/require-owner", async () => {
  const { unauthorizedResponse } = await import("../auth/unauthorized");
  return { requireOwner: vi.fn(async () => ({ ok: false, response: unauthorizedResponse() })) };
});

// The proxy's Clerk wrapper: run our callback with a signed-out session.
vi.mock("@clerk/nextjs/server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  clerkMiddleware:
    (handler: (auth: () => Promise<unknown>, req: NextRequest) => unknown) => (req: NextRequest) =>
      handler(async () => ({ isAuthenticated: false, redirectToSignIn: () => new Response(null, { status: 307 }) }), req),
}));

const FOREIGN_ORIGIN = "https://evil.example";
const ID = "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f";
const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const;

type Kind = "owner" | "widget" | "no-cors";
type RouteModule = Partial<Record<(typeof METHODS)[number] | "OPTIONS", (req: Request, ctx: unknown) => Promise<Response> | Response>>;

/** Every API route. A new route fails the inventory test until it's listed here. */
const ROUTE_LIST: { path: string; kind: Kind; load: () => Promise<unknown> }[] = [
  { path: "/api/projects", kind: "owner", load: () => import("../../app/api/projects/route") },
  { path: "/api/projects/[id]", kind: "owner", load: () => import("../../app/api/projects/[id]/route") },
  { path: "/api/projects/[id]/config", kind: "owner", load: () => import("../../app/api/projects/[id]/config/route") },
  { path: "/api/projects/[id]/conversations", kind: "owner", load: () => import("../../app/api/projects/[id]/conversations/route") },
  { path: "/api/projects/[id]/knowledge", kind: "owner", load: () => import("../../app/api/projects/[id]/knowledge/route") },
  { path: "/api/projects/[id]/knowledge/finalize", kind: "owner", load: () => import("../../app/api/projects/[id]/knowledge/finalize/route") },
  { path: "/api/projects/[id]/knowledge/upload-url", kind: "owner", load: () => import("../../app/api/projects/[id]/knowledge/upload-url/route") },
  { path: "/api/knowledge/[id]", kind: "owner", load: () => import("../../app/api/knowledge/[id]/route") },
  { path: "/api/conversations/[id]", kind: "owner", load: () => import("../../app/api/conversations/[id]/route") },
  { path: "/api/widget/config", kind: "widget", load: () => import("../../app/api/widget/config/route") },
  { path: "/api/widget/chat", kind: "widget", load: () => import("../../app/api/widget/chat/route") },
  { path: "/api/clerk/webhook", kind: "no-cors", load: () => import("../../app/api/clerk/webhook/route") },
  { path: "/api/posthog-config", kind: "no-cors", load: () => import("../../app/api/posthog-config/route") },
];

// Handlers differ in their context types; the tests only need the shared call shape.
const ROUTES = ROUTE_LIST.map((r) => ({ ...r, load: async () => (await r.load()) as RouteModule }));

const urlFor = (path: string) => `https://askwell.test${path.replace("[id]", ID)}`;

function foreignRequest(path: string, method: string): NextRequest {
  const headers: Record<string, string> = { Origin: FOREIGN_ORIGIN };
  if (method === "OPTIONS") {
    headers["Access-Control-Request-Method"] = "POST";
    headers["Access-Control-Request-Headers"] = "content-type";
  } else if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }
  const body = method === "GET" || method === "HEAD" || method === "OPTIONS" ? undefined : "{}";
  return new NextRequest(urlFor(path), { method, headers, body });
}

function corsHeaders(res: Response): string[] {
  return [...res.headers.keys()].filter((key) => key.toLowerCase().startsWith("access-control-"));
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("API route inventory", () => {
  test("every route under app/api is classified", () => {
    const apiDir = fileURLToPath(new URL("../../app/api", import.meta.url));
    const found = (readdirSync(apiDir, { recursive: true }) as string[])
      // Next accepts route.{js,jsx,ts,tsx}; any of them is a route.
      .filter((file) => /(^|[\\/])route\.[jt]sx?$/.test(file))
      .map((file) => `/api/${relative(apiDir, join(apiDir, file)).split(sep).slice(0, -1).join("/")}`)
      .sort();
    expect(found).toEqual(ROUTES.map((r) => r.path).sort());
  });
});

describe.each(ROUTES.filter((r) => r.kind !== "widget"))("$path ($kind)", ({ path, load }) => {
  test("defines no OPTIONS handler of its own", async () => {
    expect((await load()).OPTIONS).toBeUndefined();
  });

  test("a foreign-origin preflight gets Next's 204 with no Access-Control-* header", async () => {
    const handlers = autoImplementMethods((await load()) as never) as Record<string, (req: Request) => Response>;
    const res = await handlers.OPTIONS!(foreignRequest(path, "OPTIONS"));
    expect(res.status).toBe(204);
    expect(corsHeaders(res)).toEqual([]);
  });

  test("every method answers a foreign origin with no Access-Control-* header", async () => {
    const mod = await load();
    const methods = METHODS.filter((m) => mod[m]);
    expect(methods.length).toBeGreaterThan(0);
    for (const method of methods) {
      const res = await mod[method]!(foreignRequest(path, method), { params: Promise.resolve({ id: ID }) });
      expect(corsHeaders(res), `${method} ${path}`).toEqual([]);
    }
  });
});

describe.each(ROUTES.filter((r) => r.kind === "widget"))("$path (widget)", ({ path, load }) => {
  test("answers a foreign-origin preflight with 204 and Access-Control-Allow-Origin: *", async () => {
    const { OPTIONS } = await load();
    const res = await OPTIONS!(foreignRequest(path, "OPTIONS"), undefined);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});

describe("proxy", () => {
  const run = async (path: string, method: string): Promise<Response | undefined> => {
    const { default: proxy } = await import("../../proxy");
    return (await (proxy as unknown as (req: NextRequest) => Promise<Response | undefined>)(foreignRequest(path, method))) ?? undefined;
  };

  test.each(ROUTES.filter((r) => r.kind === "owner").map((r) => r.path))(
    "a signed-out foreign preflight to %s gets a 401 with no Access-Control-* header",
    async (path) => {
      const res = await run(path, "OPTIONS");
      expect(res?.status).toBe(401);
      expect(corsHeaders(res!)).toEqual([]);
    },
  );

  test.each(ROUTES.filter((r) => r.kind !== "owner").map((r) => r.path))(
    "%s passes through to its route handler",
    async (path) => {
      expect(await run(path, "OPTIONS")).toBeUndefined();
    },
  );
});
