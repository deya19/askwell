import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { PROJECT_FILES_PAGE_SIZE, listProjectFiles, removeProjectFiles } = await import("./project-files");

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

type Entry = { name: string; id: string | null };
type ListOptions = { limit: number; offset: number; sortBy: { column: string; order: string } };

/** A fake bucket: `folders` maps a folder path to its entries, listed a page at a time. */
function fakeStorage(folders: Record<string, Entry[]>) {
  const bucket = {
    list: vi.fn(async (path: string, { limit, offset }: ListOptions) => ({
      data: (folders[path] ?? []).slice(offset, offset + limit),
      error: null as { message: string } | null,
    })),
    remove: vi.fn<(paths: string[]) => Promise<{ error: { message: string } | null }>>(async () => ({ error: null })),
  };
  const from = vi.fn<(bucketName: string) => typeof bucket>(() => bucket);
  return { client: { storage: { from } }, bucket, from };
}

function files(count: number, prefix = "f"): Entry[] {
  return Array.from({ length: count }, (_, i) => ({ name: `${prefix}${String(i).padStart(4, "0")}.pdf`, id: `id-${i}` }));
}

beforeEach(() => vi.clearAllMocks());

describe("listProjectFiles", () => {
  it("lists the project's folder in the knowledge bucket, as full paths", async () => {
    const { client, from, bucket } = fakeStorage({ [PROJECT_ID]: [{ name: "a.pdf", id: "1" }, { name: "b.txt", id: "2" }] });

    await expect(listProjectFiles(client, PROJECT_ID)).resolves.toEqual([`${PROJECT_ID}/a.pdf`, `${PROJECT_ID}/b.txt`]);
    expect(from).toHaveBeenCalledWith("knowledge");
    expect(bucket.list).toHaveBeenCalledWith(PROJECT_ID, expect.objectContaining({ offset: 0 }));
  });

  it("pages through more files than one page holds", async () => {
    const { client, bucket } = fakeStorage({ [PROJECT_ID]: files(PROJECT_FILES_PAGE_SIZE * 2 + 5) });

    const paths = await listProjectFiles(client, PROJECT_ID);

    expect(paths).toHaveLength(PROJECT_FILES_PAGE_SIZE * 2 + 5);
    expect(new Set(paths).size).toBe(paths.length);
    expect(bucket.list.mock.calls.map(([, o]) => o.offset)).toEqual([0, 100, 200]);
  });

  it("stops after a full last page with one empty page", async () => {
    const { client, bucket } = fakeStorage({ [PROJECT_ID]: files(PROJECT_FILES_PAGE_SIZE) });

    await expect(listProjectFiles(client, PROJECT_ID)).resolves.toHaveLength(PROJECT_FILES_PAGE_SIZE);
    expect(bucket.list).toHaveBeenCalledTimes(2);
  });

  it("skips folder entries", async () => {
    const { client } = fakeStorage({ [PROJECT_ID]: [{ name: "nested", id: null }, { name: "a.md", id: "1" }] });

    await expect(listProjectFiles(client, PROJECT_ID)).resolves.toEqual([`${PROJECT_ID}/a.md`]);
  });

  it("throws on a Storage error", async () => {
    const { client, bucket } = fakeStorage({});
    bucket.list.mockResolvedValueOnce({ data: [], error: { message: "boom" } });

    await expect(listProjectFiles(client, PROJECT_ID)).rejects.toThrow("Could not list project files: boom");
  });
});

describe("removeProjectFiles", () => {
  it("removes only the project's own files", async () => {
    const other = "33333333-3333-4333-8333-333333333333";
    const { client, bucket } = fakeStorage({
      [PROJECT_ID]: [{ name: "a.pdf", id: "1" }],
      [other]: [{ name: "b.pdf", id: "2" }],
    });

    await expect(removeProjectFiles(client, PROJECT_ID)).resolves.toBe(1);
    expect(bucket.remove).toHaveBeenCalledExactlyOnceWith([`${PROJECT_ID}/a.pdf`]);
  });

  it("removes in batches of one page", async () => {
    const { client, bucket } = fakeStorage({ [PROJECT_ID]: files(PROJECT_FILES_PAGE_SIZE + 1) });

    await expect(removeProjectFiles(client, PROJECT_ID)).resolves.toBe(PROJECT_FILES_PAGE_SIZE + 1);
    expect(bucket.remove.mock.calls.map(([paths]) => paths.length)).toEqual([PROJECT_FILES_PAGE_SIZE, 1]);
    expect(bucket.remove.mock.calls.flatMap(([paths]) => paths).every((p) => p.startsWith(`${PROJECT_ID}/`))).toBe(true);
  });

  it("does nothing when the project has no files", async () => {
    const { client, bucket } = fakeStorage({});

    await expect(removeProjectFiles(client, PROJECT_ID)).resolves.toBe(0);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("throws when a remove fails", async () => {
    const { client, bucket } = fakeStorage({ [PROJECT_ID]: [{ name: "a.pdf", id: "1" }] });
    bucket.remove.mockResolvedValueOnce({ error: { message: "nope" } });

    await expect(removeProjectFiles(client, PROJECT_ID)).rejects.toThrow("Could not remove project files: nope");
  });
});
