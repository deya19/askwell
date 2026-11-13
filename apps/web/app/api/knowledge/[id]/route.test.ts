import { beforeEach, describe, expect, it, vi } from "vitest";
import { eqValue } from "../../../../lib/knowledge/fake-supabase";
import * as setup from "../../../../lib/knowledge/route-test-setup";

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/auth/require-owner", async () =>
  (await import("../../../../lib/knowledge/route-test-setup")).mocks.requireOwner(),
);
vi.mock("../../../../lib/supabase/owner", async () =>
  (await import("../../../../lib/knowledge/route-test-setup")).mocks.owner(),
);
vi.mock("../../../../lib/supabase/service", async () =>
  (await import("../../../../lib/knowledge/route-test-setup")).mocks.service(),
);

const { DELETE } = await import("./route");
const { PROJECT_ID, SOURCE_ID, owner, service, state } = setup;

const KEY = `${PROJECT_ID}/obj.pdf`;
/** The source as RLS shows it to the caller: null when it isn't in their projects. */
let visible: { id: string; project_id: string; storage_key: string | null } | null;

function del(id = SOURCE_ID) {
  return DELETE(new Request(`http://localhost/api/knowledge/${id}`, { method: "DELETE" }), setup.ctx(id));
}

beforeEach(() => {
  setup.resetState();
  visible = { id: SOURCE_ID, project_id: PROJECT_ID, storage_key: KEY };
  state.owner = (q) => (q.table === "knowledge_sources" ? { data: visible, error: null } : undefined);
});

describe("DELETE /api/knowledge/:id", () => {
  it("loads the source through the owner client, deletes its file, then its row", async () => {
    const res = await del();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(eqValue(owner.queries[0]!, "id")).toBe(SOURCE_ID);
    expect(service.storageFrom).toHaveBeenCalledWith("knowledge");
    expect(service.storage.remove).toHaveBeenCalledWith([KEY]);

    const rowDelete = service.queries.find((q) => q.op === "delete");
    expect(rowDelete?.table).toBe("knowledge_sources");
    expect(eqValue(rowDelete!, "id")).toBe(SOURCE_ID);
    expect(eqValue(rowDelete!, "project_id")).toBe(PROJECT_ID);
    // The file goes before the row, so a failure never leaves an orphan file.
    expect(service.storage.remove.mock.invocationCallOrder[0]).toBeLessThan(service.client.from.mock.invocationCallOrder[0]!);
  });

  it("deletes pasted text without touching Storage", async () => {
    visible = { id: SOURCE_ID, project_id: PROJECT_ID, storage_key: null };
    const res = await del();
    expect(res.status).toBe(200);
    expect(service.storage.remove).not.toHaveBeenCalled();
    expect(service.queries.some((q) => q.op === "delete")).toBe(true);
  });

  it("returns 404 for another owner's source, without a service-client call", async () => {
    visible = null;
    const res = await del();
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "not_found" } });
    expect(service.client.from).not.toHaveBeenCalled();
    expect(service.storageFrom).not.toHaveBeenCalled();
  });

  it("returns 404 for an id that isn't a UUID", async () => {
    const res = await del("nope");
    expect(res.status).toBe(404);
    expect(owner.client.from).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out", async () => {
    state.signedIn = false;
    const res = await del();
    expect(res.status).toBe(401);
    expect(owner.client.from).not.toHaveBeenCalled();
  });

  it("keeps the row when the file can't be deleted (500)", async () => {
    service.storage.remove.mockResolvedValueOnce({ data: [], error: { message: "storage down" } });
    const res = await del();
    expect(res.status).toBe(500);
    expect(service.queries.some((q) => q.op === "delete")).toBe(false);
  });
});
