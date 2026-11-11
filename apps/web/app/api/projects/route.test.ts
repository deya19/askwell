import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// --- Session -----------------------------------------------------------------

const USER_ID = "user_owner";
let signedIn = true;
vi.mock("../../../lib/auth/require-owner", async () => {
  const { unauthorizedResponse } = await import("../../../lib/auth/unauthorized");
  return {
    requireOwner: vi.fn(async () =>
      signedIn ? { ok: true, userId: USER_ID } : { ok: false, response: unauthorizedResponse() },
    ),
  };
});

// --- Owner client (RLS-scoped reads) -----------------------------------------

type DbError = { code?: string; message: string } | null;

const row = {
  id: "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f",
  owner_id: USER_ID,
  name: "Docs site",
  public_key: "pk_0123456789abcdef0123456789abcdef",
  messages_used: 3,
  period_start: "2026-11-01T00:00:00+00:00",
  created_at: "2026-11-02T00:00:00+00:00",
};
const project = {
  id: row.id,
  name: row.name,
  publicKey: row.public_key,
  messagesUsed: 3,
  periodStart: row.period_start,
  createdAt: row.created_at,
};

let listResult: { data: (typeof row)[] | null; error: DbError } = { data: [], error: null };
let accountResult: { data: { plan: string } | null; error: DbError } = { data: { plan: "free" }, error: null };

const projectsQuery = {
  select: vi.fn(() => projectsQuery),
  order: vi.fn(async () => listResult),
};
const accountsQuery = {
  select: vi.fn(() => accountsQuery),
  eq: vi.fn(() => accountsQuery),
  maybeSingle: vi.fn(async () => accountResult),
};
const ownerFrom = vi.fn((table: string) => (table === "accounts" ? accountsQuery : projectsQuery));
const createOwnerClient = vi.fn(async () => ({ from: ownerFrom }));
vi.mock("../../../lib/supabase/owner", () => ({ createOwnerClient }));

// --- Service client (create_project only) ------------------------------------

let rpcResult: { data: typeof row | null; error: DbError } = { data: row, error: null };
const rpc = vi.fn<(name: string, args: Record<string, unknown>) => { single: () => Promise<typeof rpcResult> }>(
  () => ({ single: vi.fn(async () => rpcResult) }),
);
const createServiceClient = vi.fn(() => ({ rpc }));
vi.mock("../../../lib/supabase/service", () => ({ createServiceClient }));

const { GET, POST } = await import("./route");

function post(body: unknown): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  signedIn = true;
  listResult = { data: [], error: null };
  accountResult = { data: { plan: "free" }, error: null };
  rpcResult = { data: row, error: null };
});

describe("GET /api/projects", () => {
  it("lists the caller's projects newest first, through the owner client", async () => {
    listResult = { data: [row], error: null };

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ projects: [project] });
    expect(ownerFrom).toHaveBeenCalledWith("projects");
    expect(projectsQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("doesn't leak owner_id", async () => {
    listResult = { data: [row], error: null };
    const body = await (await GET()).json();
    expect(JSON.stringify(body)).not.toContain(USER_ID);
  });

  it("returns 401 JSON when signed out, without touching the database", async () => {
    signedIn = false;

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
    expect(createOwnerClient).not.toHaveBeenCalled();
  });

  it("returns 500 without details on a database error", async () => {
    listResult = { data: null, error: { message: "relation secret_table does not exist" } };

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: "internal_error" } });
    expect(JSON.stringify(body)).not.toContain("secret_table");
  });
});

describe("POST /api/projects", () => {
  it("creates a project on Free with the Free limit and returns 201", async () => {
    const res = await POST(post({ name: "Docs site" }));

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ project });
    expect(rpc).toHaveBeenCalledWith("create_project", {
      owner_id: USER_ID,
      name: "Docs site",
      max_projects: 1,
    });
  });

  it("passes the Pro limit for a Pro account", async () => {
    accountResult = { data: { plan: "pro" }, error: null };

    await POST(post({ name: "Docs site" }));

    expect(rpc.mock.lastCall?.[1]).toMatchObject({ max_projects: 5 });
  });

  it("reads the plan from the caller's accounts row with the owner client", async () => {
    await POST(post({ name: "Docs site" }));

    expect(ownerFrom).toHaveBeenCalledWith("accounts");
    expect(accountsQuery.eq).toHaveBeenCalledWith("clerk_user_id", USER_ID);
  });

  it("ignores a plan, owner or limit sent in the body", async () => {
    accountResult = { data: { plan: "free" }, error: null };

    const res = await POST(
      post({ name: "Docs site", plan: "pro", owner_id: "user_other", max_projects: 99, projects: 99 }),
    );

    expect(res.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_project", {
      owner_id: USER_ID,
      name: "Docs site",
      max_projects: 1,
    });
  });

  it("trims the name", async () => {
    await POST(post({ name: "  Docs site  " }));
    expect(rpc.mock.lastCall?.[1]).toMatchObject({ name: "Docs site" });
  });

  it("returns 402 limit_reached when the plan's limit is hit", async () => {
    rpcResult = { data: null, error: { code: "AWL01", message: "project_limit_reached" } };

    const res = await POST(post({ name: "Second" }));

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: "limit_reached" } });
    expect(body.error.message).toMatch(/Free plan includes 1 project/);
  });

  it("returns 409 conflict when the account row doesn't exist yet, without creating anything", async () => {
    accountResult = { data: null, error: null };

    const res = await POST(post({ name: "Docs site" }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "conflict" } });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("returns 409 when the account disappears before the insert", async () => {
    rpcResult = { data: null, error: { code: "P0002", message: "account_not_found" } };

    const res = await POST(post({ name: "Docs site" }));

    expect(res.status).toBe(409);
  });

  it("returns 401 JSON when signed out, without touching the database", async () => {
    signedIn = false;

    const res = await POST(post({ name: "Docs site" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
    expect(createOwnerClient).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["a missing name", {}],
    ["a blank name", { name: "   " }],
    ["a name over 80 characters", { name: "x".repeat(81) }],
    ["a non-string name", { name: 42 }],
  ])("returns 400 invalid_request for %s", async (_label, body) => {
    const res = await POST(post(body));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "invalid_request" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 500 without details on an unexpected database error", async () => {
    rpcResult = { data: null, error: { code: "XX000", message: "internal secret detail" } };

    const res = await POST(post({ name: "Docs site" }));

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });

  it("returns 500 for an unknown plan instead of guessing one", async () => {
    accountResult = { data: { plan: "enterprise" }, error: null };

    const res = await POST(post({ name: "Docs site" }));

    expect(res.status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });
});
