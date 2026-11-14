import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let signedIn = true;
vi.mock("../../../../lib/auth/require-owner", async () => {
  const { unauthorizedResponse } = await import("../../../../lib/auth/unauthorized");
  return {
    requireOwner: vi.fn(async () =>
      signedIn ? { ok: true, userId: "user_owner" } : { ok: false, response: unauthorizedResponse() },
    ),
  };
});

type DbError = { message: string } | null;

const ID = "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f";
const row = {
  id: ID,
  owner_id: "user_owner",
  name: "Renamed",
  public_key: "pk_0123456789abcdef0123456789abcdef",
  messages_used: 0,
  period_start: "2026-11-01T00:00:00+00:00",
  created_at: "2026-11-01T00:00:00+00:00",
};

// RLS hides other owners' rows, so "not visible" comes back as no row.
let updateResult: { data: typeof row | null; error: DbError } = { data: row, error: null };
let deleteResult: { data: { id: string }[] | null; error: DbError } = { data: [{ id: ID }], error: null };

const updateQuery = {
  eq: vi.fn(() => updateQuery),
  select: vi.fn(() => updateQuery),
  maybeSingle: vi.fn(async () => updateResult),
};
const deleteQuery = {
  eq: vi.fn(() => deleteQuery),
  select: vi.fn(async () => deleteResult),
};
const table = {
  update: vi.fn<(values: Record<string, unknown>) => typeof updateQuery>(() => updateQuery),
  delete: vi.fn(() => deleteQuery),
};
const from = vi.fn(() => table);
const createOwnerClient = vi.fn(async () => ({ from }));
// The service client's Storage: one listing page of the project's files, then remove.
let storedFiles: { name: string; id: string | null }[] = [];
let listError: { message: string } | null = null;
type StorageError = { message: string } | null;
const bucket = {
  list: vi.fn<(path: string, options: unknown) => Promise<{ data: typeof storedFiles | null; error: StorageError }>>(
    async () => ({ data: listError ? null : storedFiles, error: listError }),
  ),
  remove: vi.fn<(paths: string[]) => Promise<{ data: unknown[]; error: StorageError }>>(async () => ({
    data: [],
    error: null,
  })),
};
const storageFrom = vi.fn<(bucketName: string) => typeof bucket>(() => bucket);
const createServiceClient = vi.fn(() => ({ storage: { from: storageFrom } }));
vi.mock("../../../../lib/supabase/owner", () => ({ createOwnerClient }));
vi.mock("../../../../lib/supabase/service", () => ({ createServiceClient }));

const { PATCH, DELETE } = await import("./route");

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patch(body: unknown): Request {
  return new Request(`http://localhost/api/projects/${ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const del = () => new Request(`http://localhost/api/projects/${ID}`, { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  signedIn = true;
  updateResult = { data: row, error: null };
  deleteResult = { data: [{ id: ID }], error: null };
  storedFiles = [{ name: "a.pdf", id: "obj-1" }, { name: "b.txt", id: "obj-2" }];
  listError = null;
});

describe("PATCH /api/projects/:id", () => {
  it("renames the project through the owner client and returns it", async () => {
    const res = await PATCH(patch({ name: "  Renamed " }), context(ID));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      project: {
        id: ID,
        name: "Renamed",
        publicKey: row.public_key,
        messagesUsed: 0,
        periodStart: row.period_start,
        createdAt: row.created_at,
      },
    });
    expect(from).toHaveBeenCalledWith("projects");
    expect(table.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", ID);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("updates only the name, whatever else the body sends", async () => {
    await PATCH(patch({ name: "Renamed", owner_id: "user_other", public_key: "pk_x", messages_used: 0 }), context(ID));
    expect(table.update).toHaveBeenCalledWith({ name: "Renamed" });
  });

  it("returns 404 for a project the caller can't see", async () => {
    updateResult = { data: null, error: null };

    const res = await PATCH(patch({ name: "Renamed" }), context(ID));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "not_found" } });
  });

  it("returns 404 for an id that isn't a UUID, without a query", async () => {
    const res = await PATCH(patch({ name: "Renamed" }), context("not-a-uuid"));

    expect(res.status).toBe(404);
    expect(createOwnerClient).not.toHaveBeenCalled();
  });

  it("returns 401 JSON when signed out", async () => {
    signedIn = false;

    const res = await PATCH(patch({ name: "Renamed" }), context(ID));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
    expect(createOwnerClient).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid JSON", "{"],
    ["a missing name", {}],
    ["a blank name", { name: "" }],
    ["a name over 80 characters", { name: "x".repeat(81) }],
  ])("returns 400 invalid_request for %s", async (_label, body) => {
    const res = await PATCH(patch(body), context(ID));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "invalid_request" } });
    expect(table.update).not.toHaveBeenCalled();
  });

  it("returns 500 without details on a database error", async () => {
    updateResult = { data: null, error: { message: "secret detail" } };

    const res = await PATCH(patch({ name: "Renamed" }), context(ID));

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});

describe("DELETE /api/projects/:id", () => {
  it("deletes the project through the owner client and returns ok", async () => {
    const res = await DELETE(del(), context(ID));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(table.delete).toHaveBeenCalledOnce();
    expect(deleteQuery.eq).toHaveBeenCalledWith("id", ID);
  });

  it("then removes the project's files, and only under its own prefix", async () => {
    const res = await DELETE(del(), context(ID));

    expect(res.status).toBe(200);
    expect(storageFrom).toHaveBeenCalledWith("knowledge");
    expect(bucket.list).toHaveBeenCalledWith(ID, expect.anything());
    expect(bucket.remove).toHaveBeenCalledExactlyOnceWith([`${ID}/a.pdf`, `${ID}/b.txt`]);
    // Rows first, then files.
    expect(deleteQuery.select.mock.invocationCallOrder[0]).toBeLessThan(bucket.list.mock.invocationCallOrder[0]!);
  });

  it("still returns ok, and logs, when removing the files fails", async () => {
    listError = { message: "storage down" };

    const res = await DELETE(del(), context(ID));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(bucket.remove).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(ID), expect.any(Error));
  });

  it("still returns ok when the remove call itself fails", async () => {
    bucket.remove.mockResolvedValueOnce({ data: [], error: { message: "nope" } });

    const res = await DELETE(del(), context(ID));

    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("returns 404 for a project the caller can't see, and touches no files", async () => {
    deleteResult = { data: [], error: null };

    const res = await DELETE(del(), context(ID));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "not_found" } });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(bucket.list).not.toHaveBeenCalled();
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("returns 404 for an id that isn't a UUID, without a query", async () => {
    const res = await DELETE(del(), context("123"));

    expect(res.status).toBe(404);
    expect(createOwnerClient).not.toHaveBeenCalled();
  });

  it("returns 401 JSON when signed out", async () => {
    signedIn = false;

    const res = await DELETE(del(), context(ID));

    expect(res.status).toBe(401);
    expect(createOwnerClient).not.toHaveBeenCalled();
  });

  it("returns 500 without details on a database error", async () => {
    deleteResult = { data: null, error: { message: "secret detail" } };

    const res = await DELETE(del(), context(ID));

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});
