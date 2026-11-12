import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { KNOWLEDGE_FILE_MIME_TYPES, MAX_KNOWLEDGE_FILE_BYTES } from "@askwell/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_DIR, asAnon, asServiceRole, asUser, createTestDatabase } from "../supabase-pglite";

/** Booting pglite and migrating takes a few seconds, more when test files run in parallel. */
const BOOT_TIMEOUT = 60_000;

type Bucket = { public: boolean; file_size_limit: string; allowed_mime_types: string[] };

describe("knowledge bucket", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDatabase();
    await db.query(
      "insert into storage.objects (bucket_id, name) values ('knowledge', 'project-a/manual.pdf')",
    );
  }, BOOT_TIMEOUT);

  afterAll(async () => {
    await db?.close();
  });

  it("is private, with the shared size limit and only the knowledge MIME types", async () => {
    const { rows } = await db.query<Bucket>(
      "select public, file_size_limit::text, allowed_mime_types from storage.buckets where id = 'knowledge'",
    );
    expect(rows).toHaveLength(1);
    const bucket = rows[0]!;
    expect(bucket.public).toBe(false);
    expect(Number(bucket.file_size_limit)).toBe(MAX_KNOWLEDGE_FILE_BYTES);
    expect([...bucket.allowed_mime_types].sort()).toEqual(Object.values(KNOWLEDGE_FILE_MIME_TYPES).sort());
  });

  it("adds no storage.objects policies at all (only the service role reaches files)", async () => {
    const { rows } = await db.query("select policyname from pg_policies where schemaname = 'storage'");
    expect(rows).toEqual([]);
  });

  it("hides every object from anon and signed-in owners", async () => {
    const select = "select name from storage.objects where bucket_id = 'knowledge'";
    expect((await asAnon(db, (tx) => tx.query(select))).rows).toEqual([]);
    expect((await asUser(db, "user_storage_owner", (tx) => tx.query(select))).rows).toEqual([]);
  });

  it("lets neither anon nor a signed-in owner upload", async () => {
    const insert = "insert into storage.objects (bucket_id, name) values ('knowledge', 'x/evil.pdf')";
    await expect(asAnon(db, (tx) => tx.query(insert))).rejects.toThrow(/row-level security/);
    await expect(asUser(db, "user_storage_owner", (tx) => tx.query(insert))).rejects.toThrow(/row-level security/);
  });

  it("lets the service role read objects", async () => {
    const { rows } = await asServiceRole(db, (tx) =>
      tx.query<{ name: string }>("select name from storage.objects where bucket_id = 'knowledge'"),
    );
    expect(rows).toEqual([{ name: "project-a/manual.pdf" }]);
  });

  it("can run twice without changing the bucket (idempotent)", async () => {
    const sql = await readFile(`${MIGRATIONS_DIR}/20261112101326_knowledge_bucket.sql`, "utf8");
    await db.exec(sql);
    const { rows } = await db.query("select id from storage.buckets where id = 'knowledge'");
    expect(rows).toHaveLength(1);
  });
});
