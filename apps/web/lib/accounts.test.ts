import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let userId: string | null = "user_new";
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId })),
}));

type AccountRow = { clerk_user_id: string; plan: string };
type UpsertOptions = { onConflict?: string; ignoreDuplicates?: boolean };

/**
 * A fake `accounts` table that behaves like `insert … on conflict do nothing`:
 * a conflicting row is skipped, and only inserted rows come back from select().
 */
const table = new Map<string, AccountRow>();
let failWith: string | null = null;

const upsert = vi.fn((row: AccountRow, options: UpsertOptions) => ({
  select: vi.fn(async () => {
    if (failWith) return { data: null, error: { message: failWith } };
    if (table.has(row.clerk_user_id)) {
      if (!options.ignoreDuplicates) table.set(row.clerk_user_id, row);
      return { data: [], error: null };
    }
    table.set(row.clerk_user_id, row);
    return { data: [{ clerk_user_id: row.clerk_user_id }], error: null };
  }),
}));
const from = vi.fn(() => ({ upsert }));
const createServiceClient = vi.fn(() => ({ from }));
vi.mock("./supabase/service", () => ({ createServiceClient }));

const { ensureAccount } = await import("./accounts");

describe("ensureAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    table.clear();
    userId = "user_new";
    failWith = null;
  });

  it("inserts a free account for the signed-in user", async () => {
    await expect(ensureAccount()).resolves.toEqual({ userId: "user_new", created: true });

    expect(from).toHaveBeenCalledWith("accounts");
    expect(upsert).toHaveBeenCalledWith(
      { clerk_user_id: "user_new", plan: "free" },
      { onConflict: "clerk_user_id", ignoreDuplicates: true },
    );
    expect([...table.values()]).toEqual([{ clerk_user_id: "user_new", plan: "free" }]);
  });

  it("is a no-op on the second call", async () => {
    await ensureAccount();
    await expect(ensureAccount()).resolves.toEqual({ userId: "user_new", created: false });
    expect(table.size).toBe(1);
  });

  it("never downgrades an existing account's plan", async () => {
    table.set("user_new", { clerk_user_id: "user_new", plan: "pro" });
    await expect(ensureAccount()).resolves.toEqual({ userId: "user_new", created: false });
    expect(table.get("user_new")?.plan).toBe("pro");
  });

  it("throws when nobody is signed in, without touching the database", async () => {
    userId = null;
    await expect(ensureAccount()).rejects.toThrow("signed-in user");
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("throws on a database error", async () => {
    failWith = "boom";
    await expect(ensureAccount()).rejects.toThrow("Could not create account: boom");
  });
});
