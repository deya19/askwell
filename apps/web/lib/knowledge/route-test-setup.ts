// Test helper shared by the knowledge route tests. Each test file wires these into vi.mock
// factories, so a test sets `state` and reads the recorded queries.
import { vi } from "vitest";
import { unauthorizedResponse } from "../auth/unauthorized";
import { fakeSupabase, type DbResult, type Query } from "./fake-supabase";

export const USER_ID = "user_owner";
export const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
export const OTHER_PROJECT_ID = "33333333-3333-4333-8333-333333333333";
export const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
export const CREATED_AT = "2026-11-13T10:00:00.123456+00:00";

export const projectRow = {
  id: PROJECT_ID,
  owner_id: USER_ID,
  name: "Docs",
  public_key: "pk_0123456789abcdef0123456789abcdef",
  messages_used: 0,
  period_start: "2026-11-01T00:00:00+00:00",
  created_at: CREATED_AT,
};

export function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SOURCE_ID,
    project_id: PROJECT_ID,
    title: "FAQ",
    type: "text",
    storage_key: null as string | null,
    status: "processing",
    created_at: CREATED_AT,
    ...overrides,
  };
}

type Override = (query: Query) => DbResult | undefined;

export const state = {
  signedIn: true,
  plan: "free" as string | null,
  /** Per-test answers for service-client queries. */
  service: (() => undefined) as Override,
  /** Per-test answers for owner-client queries other than the plan read. */
  owner: (() => undefined) as Override,
};

export const service = fakeSupabase((q) => state.service(q) ?? { data: null, error: null });
export const owner = fakeSupabase((q) => {
  if (q.table === "accounts") return { data: state.plan ? { plan: state.plan } : null, error: null };
  return state.owner(q) ?? { data: null, error: null };
});

export const afterCallbacks: (() => unknown)[] = [];
export const processKnowledgeSource = vi.fn(async () => "ready" as const);

export const mocks = {
  requireOwner: () => ({
    requireOwner: vi.fn(async () =>
      state.signedIn ? { ok: true, userId: USER_ID } : { ok: false, response: unauthorizedResponse() },
    ),
  }),
  ownedProject: () => ({
    getOwnedProject: vi.fn(async (id: string) => (state.signedIn && id === PROJECT_ID ? projectRow : null)),
  }),
  owner: () => ({ createOwnerClient: vi.fn(async () => owner.client) }),
  service: () => ({ createServiceClient: vi.fn(() => service.client) }),
  nextServer: () => ({ after: vi.fn((cb: () => unknown) => void afterCallbacks.push(cb)) }),
  process: () => ({ processKnowledgeSource }),
};

/** Resets state and recorded calls. Call in `beforeEach`. */
export function resetState(): void {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.signedIn = true;
  state.plan = "free";
  state.service = () => undefined;
  state.owner = () => undefined;
  service.queries.length = 0;
  owner.queries.length = 0;
  service.rpcResult.current = { data: sourceRow(), error: null };
  afterCallbacks.length = 0;
}

/** Runs the `after()` callbacks the route scheduled. */
export async function runAfter(): Promise<void> {
  for (const cb of afterCallbacks) await cb();
}

export function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
