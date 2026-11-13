import { PLAN_LIMITS, createUploadUrlResponseSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eqValue } from "../../../../../../lib/knowledge/fake-supabase";
import * as setup from "../../../../../../lib/knowledge/route-test-setup";

vi.mock("server-only", () => ({}));
vi.mock("../../../../../../lib/auth/require-owner", async () =>
  (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.requireOwner(),
);
vi.mock("../../../../../../lib/supabase/owned-project", async () =>
  (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.ownedProject(),
);
vi.mock("../../../../../../lib/supabase/owner", async () =>
  (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.owner(),
);
vi.mock("../../../../../../lib/supabase/service", async () =>
  (await import("../../../../../../lib/knowledge/route-test-setup")).mocks.service(),
);

const { POST } = await import("./route");
const { PROJECT_ID, OTHER_PROJECT_ID, SOURCE_ID, service, state } = setup;

const URL = `http://localhost/api/projects/${PROJECT_ID}/knowledge/upload-url`;
const body = { fileName: "Pricing Guide.PDF", size: 123_456 };
const KEY_PATTERN = new RegExp(`^${PROJECT_ID}/[0-9a-f-]{36}\\.pdf$`);

function reservedFile() {
  service.rpcResult.current = {
    data: setup.sourceRow({ type: "pdf", status: "uploading", storage_key: `${PROJECT_ID}/x.pdf`, title: "Pricing Guide.PDF" }),
    error: null,
  };
}

beforeEach(() => {
  setup.resetState();
  reservedFile();
  // No stale reservations unless a test says so.
  state.service = (q) => (q.op === "select" ? { data: [], error: null } : undefined);
});

describe("POST /api/projects/:id/knowledge/upload-url", () => {
  it("reserves an uploading source and returns a one-time signed upload URL", async () => {
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));

    expect(res.status).toBe(201);
    const json = createUploadUrlResponseSchema.parse(await res.json());
    expect(json.source).toMatchObject({ id: SOURCE_ID, type: "pdf", status: "uploading" });
    expect(json.upload.path).toMatch(KEY_PATTERN);
    expect(json.upload.token).toBe("tok_123");

    const args = service.rpc.mock.calls[0]?.[1];
    expect(args).toMatchObject({
      project_id: PROJECT_ID,
      title: "Pricing Guide.PDF",
      type: "pdf",
      max_sources: PLAN_LIMITS.free.knowledgeSources,
    });
    expect(args?.storage_key).toMatch(KEY_PATTERN);
    expect(service.storageFrom).toHaveBeenCalledWith("knowledge");
    expect(service.storage.createSignedUploadUrl).toHaveBeenCalledWith(args?.storage_key);
  });

  it("uses the given title and the md type for .markdown", async () => {
    await POST(setup.jsonPost(URL, { fileName: "notes.markdown", size: 10, title: "Notes" }), setup.ctx(PROJECT_ID));
    const args = service.rpc.mock.calls[0]?.[1];
    expect(args).toMatchObject({ title: "Notes", type: "md" });
    expect(args?.storage_key).toMatch(/\.md$/);
  });

  it("reclaims stale reservations first: deletes their objects, then their rows", async () => {
    const stale = [
      { id: "44444444-4444-4444-8444-444444444444", storage_key: `${PROJECT_ID}/old.pdf` },
      { id: "55555555-5555-4555-8555-555555555555", storage_key: `${PROJECT_ID}/never-uploaded.txt` },
    ];
    state.service = (q) => (q.op === "select" ? { data: stale, error: null } : undefined);
    const before = Date.now();

    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));

    expect(res.status).toBe(201);
    const select = service.queries.find((q) => q.op === "select");
    expect(eqValue(select!, "project_id")).toBe(PROJECT_ID);
    expect(eqValue(select!, "status")).toBe("uploading");
    const cutoff = Date.parse(select!.filters.find(([op]) => op === "lt")?.[2] as string);
    expect(before - cutoff).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 5);
    expect(before - cutoff).toBeLessThan(2 * 60 * 60 * 1000 + 5_000);

    expect(service.storage.remove).toHaveBeenCalledWith(stale.map((s) => s.storage_key));
    const del = service.queries.find((q) => q.op === "delete");
    expect(del?.table).toBe("knowledge_sources");
    expect(eqValue(del!, "project_id")).toBe(PROJECT_ID);
    expect(eqValue(del!, "status")).toBe("uploading");
    expect(del?.filters).toContainEqual(["in", "id", stale.map((s) => s.id)]);

    // Reclaim happens before the new reservation is counted.
    expect(service.storage.remove.mock.invocationCallOrder[0]).toBeLessThan(service.rpc.mock.invocationCallOrder[0]!);
  });

  it("returns 402 limit_reached at the plan's limit, without a signed URL", async () => {
    service.rpcResult.current = { data: null, error: { code: "AWL02", message: "source_limit_reached" } };
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));
    expect(res.status).toBe(402);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "limit_reached" } });
    expect(service.storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("gives the slot back when the URL can't be signed", async () => {
    service.storage.createSignedUploadUrl.mockResolvedValueOnce({ data: null, error: { message: "storage down" } });
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));
    expect(res.status).toBe(500);
    const del = service.queries.find((q) => q.op === "delete");
    expect(eqValue(del!, "id")).toBe(SOURCE_ID);
  });

  it("returns 400 for a declared size over 10 MB or a file type that isn't allowed", async () => {
    const big = await POST(setup.jsonPost(URL, { fileName: "a.pdf", size: 11 * 1024 * 1024 }), setup.ctx(PROJECT_ID));
    expect(big.status).toBe(400);
    const exe = await POST(setup.jsonPost(URL, { fileName: "a.exe", size: 10 }), setup.ctx(PROJECT_ID));
    expect(exe.status).toBe(400);
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out", async () => {
    state.signedIn = false;
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(PROJECT_ID));
    expect(res.status).toBe(401);
    expect(service.client.from).not.toHaveBeenCalled();
  });

  it("returns 404 for another owner's project, without a service-client call", async () => {
    const res = await POST(setup.jsonPost(URL, body), setup.ctx(OTHER_PROJECT_ID));
    expect(res.status).toBe(404);
    expect(service.client.from).not.toHaveBeenCalled();
    expect(service.storageFrom).not.toHaveBeenCalled();
  });
});
