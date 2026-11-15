// Test helper shared by the conversation route and query tests. It fakes the owner client
// as RLS would show it: `state.visibleProjects` are the caller's projects, and only their
// conversations and messages come back.
import { vi } from "vitest";
import { unauthorizedResponse } from "../auth/unauthorized";

export const USER_ID = "user_owner";
export const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
export const OTHER_PROJECT_ID = "33333333-3333-4333-8333-333333333333";
export const CONVERSATION_ID = "44444444-4444-4444-8444-444444444444";
export const OTHER_CONVERSATION_ID = "55555555-5555-4555-8555-555555555555";

export type ConversationRow = { id: string; project_id: string; visitor_id: string; created_at: string };
export type MessageRow = { id: string; conversation_id: string; role: string; body: string; created_at: string };

type Filter = ["eq" | "in", string, unknown];
export type Query = {
  table: string;
  columns?: string;
  filters: Filter[];
  orders: [string, boolean][];
  limit?: number;
  range?: [number, number];
};

export const state = {
  signedIn: true,
  visibleProjects: [PROJECT_ID] as string[],
  conversations: [] as ConversationRow[],
  messages: [] as MessageRow[],
  /** Set to make every owner query fail. */
  dbError: null as string | null,
};

export const queries: Query[] = [];

function matches(row: Record<string, unknown>, filters: Filter[]): boolean {
  return filters.every(([op, column, value]) =>
    op === "eq" ? row[column] === value : (value as unknown[]).includes(row[column]),
  );
}

function pick(row: Record<string, unknown>, columns?: string): Record<string, unknown> {
  if (!columns || columns === "*") return row;
  return Object.fromEntries(columns.split(",").map((c) => [c.trim(), row[c.trim()]]));
}

function rowsFor(table: string): Record<string, unknown>[] {
  // RLS: only rows in the caller's projects.
  const conversations = state.conversations.filter((c) => state.visibleProjects.includes(c.project_id));
  if (table === "conversations") return conversations;
  if (table === "messages") {
    const ids = new Set(conversations.map((c) => c.id));
    return state.messages.filter((m) => ids.has(m.conversation_id));
  }
  throw new Error(`Unexpected table ${table}`);
}

function run(query: Query) {
  queries.push(query);
  if (state.dbError) return { data: null, error: { message: state.dbError } };
  let rows = rowsFor(query.table).filter((row) => matches(row, query.filters));
  rows = [...rows].sort((a, b) => {
    for (const [column, ascending] of query.orders) {
      const x = String(a[column]);
      const y = String(b[column]);
      if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
    }
    return 0;
  });
  if (query.range) rows = rows.slice(query.range[0], query.range[1] + 1);
  if (query.limit !== undefined) rows = rows.slice(0, query.limit);
  return { data: rows.map((row) => pick(row, query.columns)), error: null };
}

export const ownerClient = {
  from: vi.fn((table: string) => {
    const query: Query = { table, filters: [], orders: [] };
    const builder = {
      select: (columns?: string) => ((query.columns = columns), builder),
      eq: (column: string, value: unknown) => (query.filters.push(["eq", column, value]), builder),
      in: (column: string, value: unknown[]) => (query.filters.push(["in", column, value]), builder),
      order: (column: string, options?: { ascending?: boolean }) => (
        query.orders.push([column, options?.ascending ?? true]), builder
      ),
      limit: (count: number) => ((query.limit = count), builder),
      range: (from: number, to: number) => ((query.range = [from, to]), builder),
      maybeSingle: async () => {
        const result = run(query);
        return { data: result.data?.[0] ?? null, error: result.error };
      },
      then: <T>(resolve: (value: ReturnType<typeof run>) => T, reject?: (reason: unknown) => T) =>
        Promise.resolve(run(query)).then(resolve, reject),
    };
    return builder;
  }),
};

export const mocks = {
  requireOwner: () => ({
    requireOwner: vi.fn(async () =>
      state.signedIn ? { ok: true, userId: USER_ID } : { ok: false, response: unauthorizedResponse() },
    ),
  }),
  ownedProject: () => ({
    getOwnedProject: vi.fn(async (id: string) =>
      state.signedIn && state.visibleProjects.includes(id) ? { id, owner_id: USER_ID } : null,
    ),
  }),
  owner: () => ({ createOwnerClient: vi.fn(async () => ownerClient) }),
};

export function conversation(overrides: Partial<ConversationRow> = {}): ConversationRow {
  return {
    id: CONVERSATION_ID,
    project_id: PROJECT_ID,
    visitor_id: "v_visitor",
    created_at: "2026-11-14T10:00:00.000000+00:00",
    ...overrides,
  };
}

let messageSeq = 0;
export function message(overrides: Partial<MessageRow> = {}): MessageRow {
  messageSeq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(messageSeq).padStart(12, "0")}`,
    conversation_id: CONVERSATION_ID,
    role: "visitor",
    body: "Hello",
    created_at: `2026-11-14T10:00:${String(messageSeq % 60).padStart(2, "0")}.000000+00:00`,
    ...overrides,
  };
}

/** Resets state and recorded calls. Call in `beforeEach`. */
export function resetState(): void {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.signedIn = true;
  state.visibleProjects = [PROJECT_ID];
  state.conversations = [];
  state.messages = [];
  state.dbError = null;
  queries.length = 0;
  messageSeq = 0;
}

export function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
