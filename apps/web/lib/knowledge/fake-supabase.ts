// Test helper: a small fake of the supabase-js calls the knowledge code makes.
// Each query records its table, operation, payload and filters; a handler decides the result.
import { vi } from "vitest";

export type DbResult = { data: unknown; error: { code?: string; message: string } | null };

export type Query = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  columns?: string;
  filters: [string, string, unknown][];
  terminal: "many" | "maybeSingle" | "single";
};

export type Handler = (query: Query) => DbResult;

export function fakeSupabase(handler: Handler) {
  const queries: Query[] = [];

  function from(table: string) {
    const query: Query = { table, op: "select", filters: [], terminal: "many" };
    const run = () => {
      queries.push(query);
      return Promise.resolve(handler(query));
    };
    const builder = {
      select(columns?: string) {
        // `select` after a write only asks for the rows back.
        if (query.op === "select") query.columns = columns;
        return builder;
      },
      insert(payload: unknown) {
        Object.assign(query, { op: "insert", payload });
        return builder;
      },
      update(payload: unknown) {
        Object.assign(query, { op: "update", payload });
        return builder;
      },
      delete() {
        query.op = "delete";
        return builder;
      },
      eq: (column: string, value: unknown) => (query.filters.push(["eq", column, value]), builder),
      lt: (column: string, value: unknown) => (query.filters.push(["lt", column, value]), builder),
      in: (column: string, value: unknown) => (query.filters.push(["in", column, value]), builder),
      maybeSingle: () => ((query.terminal = "maybeSingle"), run()),
      single: () => ((query.terminal = "single"), run()),
      then: <T>(resolve: (value: DbResult) => T, reject?: (reason: unknown) => T) => run().then(resolve, reject),
    };
    return builder;
  }

  const rpcResult: { current: DbResult } = { current: { data: null, error: null } };
  const rpc = vi.fn<(name: string, args: Record<string, unknown>) => { single: () => Promise<DbResult> }>(() => ({
    single: async () => rpcResult.current,
  }));

  type StorageError = { message: string } | null;
  type Signed = { path: string; token: string; signedUrl: string };
  const storage = {
    remove: vi.fn<(paths: string[]) => Promise<{ data: unknown[]; error: StorageError }>>(async () => ({
      data: [],
      error: null,
    })),
    download: vi.fn<(path: string) => Promise<{ data: Blob | null; error: StorageError }>>(async () => ({
      data: new Blob([]),
      error: null,
    })),
    createSignedUploadUrl: vi.fn<(path: string) => Promise<{ data: Signed | null; error: StorageError }>>(
      async (path) => ({
        data: {
          path,
          token: "tok_123",
          signedUrl: `https://example.supabase.co/storage/v1/object/upload/sign/knowledge/${path}?token=tok_123`,
        },
        error: null,
      }),
    ),
  };
  const storageFrom = vi.fn<(bucket: string) => typeof storage>(() => storage);

  const client = { from: vi.fn(from), rpc, storage: { from: storageFrom } };
  return { client, queries, rpc, rpcResult, storage, storageFrom };
}

/** The value of an `eq` filter on a recorded query. */
export function eqValue(query: Query, column: string): unknown {
  return query.filters.find(([op, col]) => op === "eq" && col === column)?.[2];
}
