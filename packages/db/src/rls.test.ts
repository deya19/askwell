import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, asAnon, asServiceRole, asUser, createSupabasePglite, createTestDatabase } from "../supabase-pglite";

const TABLES = [
  "accounts",
  "projects",
  "widget_configs",
  "knowledge_sources",
  "knowledge_chunks",
  "conversations",
  "messages",
] as const;
type Table = (typeof TABLES)[number];

const API_ROLES = ["anon", "authenticated", "service_role"] as const;

const OWNER_A = "user_owner_a";
const OWNER_B = "user_owner_b";

/** Booting pglite and migrating takes a few seconds, more when test files run in parallel. */
const BOOT_TIMEOUT = 60_000;

/** A pgvector literal with 1536 dimensions. */
function embedding(seed: number): string {
  return `[${Array.from({ length: 1536 }, (_, i) => ((i + seed) % 7) / 7).join(",")}]`;
}

type Fixture = { projectId: string; sourceId: string; fileSourceId: string; conversationId: string };

/** One owner's full set of rows, one in every table. Inserted as the superuser. */
async function seedOwner(db: PGlite, owner: string, seed: number): Promise<Fixture> {
  await db.query("insert into public.accounts (clerk_user_id, plan) values ($1, 'free')", [owner]);
  const project = await db.query<{ id: string }>(
    "insert into public.projects (owner_id, name, public_key) values ($1, $2, $3) returning id",
    [owner, `Project ${owner}`, `pk_${owner.replace(/[^A-Za-z0-9]/g, "")}000000000000`],
  );
  const projectId = project.rows[0]!.id;
  await db.query(
    `insert into public.widget_configs (project_id, button_color, position, label, animation, header_text, show_badge)
     values ($1, '#0a0a0a', 'bottom-right', 'Ask a question', 'fade', 'How can we help?', false)`,
    [projectId],
  );
  const source = await db.query<{ id: string }>(
    `insert into public.knowledge_sources (project_id, title, type, storage_key, status)
     values ($1, 'Pasted FAQ', 'text', null, 'ready') returning id`,
    [projectId],
  );
  const sourceId = source.rows[0]!.id;
  const fileSource = await db.query<{ id: string }>(
    `insert into public.knowledge_sources (project_id, title, type, storage_key, status)
     values ($1, 'Manual', 'pdf', $2, 'ready') returning id`,
    [projectId, `${projectId}/manual.pdf`],
  );
  const fileSourceId = fileSource.rows[0]!.id;
  for (const id of [sourceId, fileSourceId]) {
    await db.query(
      "insert into public.knowledge_chunks (project_id, source_id, content, embedding) values ($1, $2, 'chunk', $3)",
      [projectId, id, embedding(seed)],
    );
  }
  const conversation = await db.query<{ id: string }>(
    "insert into public.conversations (project_id, visitor_id) values ($1, 'visitor-1') returning id",
    [projectId],
  );
  const conversationId = conversation.rows[0]!.id;
  await db.query(
    `insert into public.messages (conversation_id, role, body)
     values ($1, 'visitor', 'Hi'), ($1, 'bot', 'Hello')`,
    [conversationId],
  );
  return { projectId, sourceId, fileSourceId, conversationId };
}

/** The project each table's row belongs to, for checking which rows a caller can see. */
const PROJECT_OF: Record<Table, string> = {
  accounts: "(select p.id from public.projects p where p.owner_id = t.clerk_user_id limit 1)",
  projects: "t.id",
  widget_configs: "t.project_id",
  knowledge_sources: "t.project_id",
  knowledge_chunks: "t.project_id",
  conversations: "t.project_id",
  messages: "(select c.project_id from public.conversations c where c.id = t.conversation_id)",
};

async function visibleProjects(tx: Transaction, table: Table): Promise<string[]> {
  const result = await tx.query<{ project_id: string }>(
    `select ${PROJECT_OF[table]} as project_id from public.${table} t`,
  );
  return result.rows.map((row) => row.project_id);
}

async function count(db: PGlite, table: Table): Promise<number> {
  const result = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
  return result.rows[0]!.n;
}

async function countAll(db: PGlite): Promise<Record<Table, number>> {
  const counts = {} as Record<Table, number>;
  for (const table of TABLES) counts[table] = await count(db, table);
  return counts;
}

/** A row to try inserting into each table as a non-service role. */
function insertSql(table: Table, f: Fixture): string {
  switch (table) {
    case "accounts":
      return "insert into public.accounts (clerk_user_id) values ('user_new')";
    case "projects":
      return `insert into public.projects (owner_id, name, public_key) values ('${OWNER_A}', 'X', 'pk_newnewnewnewnewnew')`;
    case "widget_configs":
      return `insert into public.widget_configs (project_id, button_color, position, label, animation, header_text, show_badge)
              values ('${f.projectId}', '#000000', 'top-left', 'L', 'fade', 'H', true)`;
    case "knowledge_sources":
      return `insert into public.knowledge_sources (project_id, title, type, status) values ('${f.projectId}', 'T', 'text', 'ready')`;
    case "knowledge_chunks":
      return `insert into public.knowledge_chunks (project_id, source_id, content, embedding)
              values ('${f.projectId}', '${f.sourceId}', 'c', '${embedding(1)}')`;
    case "conversations":
      return `insert into public.conversations (project_id, visitor_id) values ('${f.projectId}', 'v')`;
    case "messages":
      return `insert into public.messages (conversation_id, role, body) values ('${f.conversationId}', 'bot', 'b')`;
  }
}

/** An UPDATE an owner must not be allowed to make, on each table (every column except projects.name). */
const FORBIDDEN_UPDATES: Record<Table, string> = {
  accounts: "update public.accounts set plan = 'pro'",
  projects: "update public.projects set messages_used = 0",
  widget_configs: "update public.widget_configs set show_badge = false",
  knowledge_sources: "update public.knowledge_sources set status = 'ready'",
  knowledge_chunks: "update public.knowledge_chunks set content = 'x'",
  conversations: "update public.conversations set visitor_id = 'x'",
  messages: "update public.messages set body = 'x'",
};

describe("init migration", () => {
  it("runs cleanly on an empty database", async () => {
    const db = await createSupabasePglite();
    const files = await applyMigrations(db);
    expect(files.some((file) => /^\d{14}_init\.sql$/.test(file))).toBe(true);
    const tables = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual([...TABLES].sort());
    await db.close();
  }, BOOT_TIMEOUT);
});

describe("RLS and grants", () => {
  let db: PGlite;
  let a: Fixture;
  let b: Fixture;

  beforeAll(async () => {
    db = await createTestDatabase();
    a = await seedOwner(db, OWNER_A, 1);
    b = await seedOwner(db, OWNER_B, 2);
  }, BOOT_TIMEOUT);

  afterAll(async () => {
    await db.close();
  });

  describe("catalog", () => {
    it("enables RLS on every table", async () => {
      const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'`,
      );
      expect(result.rows).toHaveLength(TABLES.length);
      for (const row of result.rows) expect(row, row.relname).toMatchObject({ relrowsecurity: true });
    });

    it("grants no API role TRUNCATE, and anon nothing at all", async () => {
      for (const table of TABLES) {
        for (const role of API_ROLES) {
          const truncate = await db.query<{ ok: boolean }>(
            "select has_table_privilege($1, $2, 'TRUNCATE') as ok",
            [role, `public.${table}`],
          );
          expect(truncate.rows[0]!.ok, `${role} TRUNCATE ${table}`).toBe(false);
        }
        const anon = await db.query<{ ok: boolean }>(
          "select has_table_privilege('anon', $1, 'SELECT,INSERT,UPDATE,DELETE,REFERENCES,TRIGGER') as ok",
          [`public.${table}`],
        );
        expect(anon.rows[0]!.ok, `anon on ${table}`).toBe(false);
      }
    });

    it("gives authenticated only SELECT, plus UPDATE(name) and DELETE on projects", async () => {
      const result = await db.query<{ table_name: string; privilege_type: string }>(
        `select table_name, privilege_type from information_schema.role_table_grants
         where grantee = 'authenticated' and table_schema = 'public' order by 1, 2`,
      );
      const expected = TABLES.flatMap((table) =>
        table === "projects" ? [`${table}:DELETE`, `${table}:SELECT`] : [`${table}:SELECT`],
      ).sort();
      expect(result.rows.map((row) => `${row.table_name}:${row.privilege_type}`).sort()).toEqual(expected);

      const columns = await db.query<{ column_name: string }>(
        `select column_name from information_schema.column_privileges
         where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'UPDATE'`,
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual(["name"]);
    });

    it("makes the helpers SECURITY DEFINER with an empty search_path, executable by authenticated only", async () => {
      for (const fn of ["owned_project_ids", "owned_conversation_ids"]) {
        const result = await db.query<{ prosecdef: boolean; proconfig: string[] }>(
          `select p.prosecdef, p.proconfig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname = $1`,
          [fn],
        );
        expect(result.rows[0]).toEqual({ prosecdef: true, proconfig: ['search_path=""'] });
        for (const [role, allowed] of [
          ["anon", false],
          ["service_role", false],
          ["authenticated", true],
        ] as const) {
          const can = await db.query<{ ok: boolean }>("select has_function_privilege($1, $2, 'EXECUTE') as ok", [
            role,
            `private.${fn}()`,
          ]);
          expect(can.rows[0]!.ok, `${role} EXECUTE ${fn}`).toBe(allowed);
        }
      }
      const publicExecute = await db.query<{ n: number }>(
        `select count(*)::int as n from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
         where n.nspname = 'private' and acl.grantee = 0`,
      );
      expect(publicExecute.rows[0]!.n).toBe(0);
    });

    it("indexes knowledge_chunks.embedding with HNSW", async () => {
      const result = await db.query<{ indexdef: string }>(
        "select indexdef from pg_indexes where tablename = 'knowledge_chunks' and indexname = 'knowledge_chunks_embedding_idx'",
      );
      expect(result.rows[0]?.indexdef).toMatch(/USING hnsw \(embedding extensions\.vector_cosine_ops\)/);
    });
  });

  describe("reads", () => {
    it.each(TABLES)("owner A sees only their own rows in %s", async (table) => {
      const seen = await asUser(db, OWNER_A, (tx) => visibleProjects(tx, table));
      expect(seen.length).toBeGreaterThan(0);
      expect(new Set(seen)).toEqual(new Set([a.projectId]));
    });

    it.each(TABLES)("owner B sees only their own rows in %s", async (table) => {
      const seen = await asUser(db, OWNER_B, (tx) => visibleProjects(tx, table));
      expect(new Set(seen)).toEqual(new Set([b.projectId]));
    });

    it.each(TABLES)("an authenticated token with no sub sees nothing in %s", async (table) => {
      const seen = await asUser(db, "", (tx) => visibleProjects(tx, table));
      expect(seen).toEqual([]);
    });

    it.each(TABLES)("anon can't read %s", async (table) => {
      await expect(asAnon(db, (tx) => tx.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    });

    it("anon can't call the helpers", async () => {
      await expect(asAnon(db, (tx) => tx.query("select * from private.owned_project_ids()"))).rejects.toThrow(
        /permission denied/,
      );
    });

    it("the service role sees every row", async () => {
      const seen = await asServiceRole(db, (tx) => visibleProjects(tx, "messages"));
      expect(new Set(seen)).toEqual(new Set([a.projectId, b.projectId]));
    });
  });

  describe("writes", () => {
    it.each(TABLES)("owners can't insert into %s", async (table) => {
      await expect(asUser(db, OWNER_A, (tx) => tx.query(insertSql(table, a)))).rejects.toThrow(/permission denied/);
    });

    it.each(TABLES)("anon can't insert into %s", async (table) => {
      await expect(asAnon(db, (tx) => tx.query(insertSql(table, a)))).rejects.toThrow(/permission denied/);
    });

    it.each(TABLES)("owners can't update other columns of %s", async (table) => {
      await expect(asUser(db, OWNER_A, (tx) => tx.query(FORBIDDEN_UPDATES[table]))).rejects.toThrow(
        /permission denied/,
      );
    });

    it.each(TABLES.filter((table) => table !== "projects"))("owners can't delete from %s", async (table) => {
      await expect(asUser(db, OWNER_A, (tx) => tx.query(`delete from public.${table}`))).rejects.toThrow(
        /permission denied/,
      );
    });

    it.each(TABLES)("anon can't update or delete %s", async (table) => {
      await expect(asAnon(db, (tx) => tx.query(FORBIDDEN_UPDATES[table]))).rejects.toThrow(/permission denied/);
      await expect(asAnon(db, (tx) => tx.query(`delete from public.${table}`))).rejects.toThrow(/permission denied/);
    });

    it.each(TABLES)("no API role can truncate %s", async (table) => {
      await expect(asUser(db, OWNER_A, (tx) => tx.query(`truncate public.${table} cascade`))).rejects.toThrow(
        /permission denied/,
      );
      await expect(asServiceRole(db, (tx) => tx.query(`truncate public.${table} cascade`))).rejects.toThrow(
        /permission denied/,
      );
    });

    it("owner A can't rename or delete owner B's project", async () => {
      const renamed = await asUser(db, OWNER_A, (tx) =>
        tx.query("update public.projects set name = 'Hijacked' where id = $1", [b.projectId]),
      );
      expect(renamed.affectedRows).toBe(0);
      const deleted = await asUser(
        db,
        OWNER_A,
        (tx) => tx.query("delete from public.projects where id = $1", [b.projectId]),
        { commit: true },
      );
      expect(deleted.affectedRows).toBe(0);
      const still = await db.query("select name from public.projects where id = $1", [b.projectId]);
      expect(still.rows).toEqual([{ name: `Project ${OWNER_B}` }]);
    });

    it("rename changes only the name", async () => {
      const before = await db.query<Record<string, unknown>>("select * from public.projects where id = $1", [
        a.projectId,
      ]);
      const result = await asUser(
        db,
        OWNER_A,
        (tx) => tx.query("update public.projects set name = 'Renamed' where id = $1", [a.projectId]),
        { commit: true },
      );
      expect(result.affectedRows).toBe(1);
      const after = await db.query<Record<string, unknown>>("select * from public.projects where id = $1", [
        a.projectId,
      ]);
      expect(after.rows[0]).toEqual({ ...before.rows[0], name: "Renamed" });
    });

    it.each(["owner_id", "public_key", "messages_used", "period_start", "created_at", "id"])(
      "owners can't change projects.%s",
      async (column) => {
        await expect(
          asUser(db, OWNER_A, (tx) =>
            tx.query(`update public.projects set ${column} = ${column} where id = $1`, [a.projectId]),
          ),
        ).rejects.toThrow(/permission denied/);
      },
    );

    it("rejects a chunk whose project doesn't match its source", async () => {
      await expect(
        asServiceRole(db, (tx) =>
          tx.query(
            "insert into public.knowledge_chunks (project_id, source_id, content, embedding) values ($1, $2, 'c', $3)",
            [b.projectId, a.sourceId, embedding(3)],
          ),
        ),
      ).rejects.toThrow(/foreign key/);
    });

    it("rejects values outside the enums", async () => {
      for (const sql of [
        `update public.accounts set plan = 'enterprise'`,
        `update public.widget_configs set position = 'middle'`,
        `update public.widget_configs set animation = 'spin'`,
        `update public.knowledge_sources set status = 'done'`,
        `update public.knowledge_sources set type = 'docx'`,
        `update public.messages set role = 'system'`,
      ]) {
        await expect(asServiceRole(db, (tx) => tx.query(sql)), sql).rejects.toThrow(/check constraint/);
      }
    });

    it("keeps public_key unique", async () => {
      await expect(
        asServiceRole(db, (tx) =>
          tx.query("update public.projects set public_key = (select public_key from public.projects where id = $1) where id = $2", [
            a.projectId,
            b.projectId,
          ]),
        ),
      ).rejects.toThrow(/unique/);
    });
  });
});

describe("cascades", () => {
  let db: PGlite;
  let a: Fixture;
  let b: Fixture;

  beforeAll(async () => {
    db = await createTestDatabase();
    a = await seedOwner(db, OWNER_A, 1);
    b = await seedOwner(db, OWNER_B, 2);
  }, BOOT_TIMEOUT);

  afterAll(async () => {
    await db.close();
  });

  it("deleting a source deletes its chunks only", async () => {
    await asServiceRole(db, (tx) => tx.query("delete from public.knowledge_sources where id = $1", [a.fileSourceId]), {
      commit: true,
    });
    const chunks = await db.query<{ source_id: string }>(
      "select source_id from public.knowledge_chunks where project_id = $1",
      [a.projectId],
    );
    expect(chunks.rows).toEqual([{ source_id: a.sourceId }]);
  });

  it("an owner deleting their project deletes everything in it, and nothing else", async () => {
    const before = await countAll(db);
    const result = await asUser(db, OWNER_A, (tx) => tx.query("delete from public.projects where id = $1", [a.projectId]), {
      commit: true,
    });
    expect(result.affectedRows).toBe(1);

    for (const table of TABLES.filter((t) => t !== "accounts")) {
      const left = await db.query(`select 1 from public.${table} t where ${PROJECT_OF[table]} = $1`, [a.projectId]);
      expect(left.rows, table).toEqual([]);
    }
    const seenByB = await asUser(db, OWNER_B, (tx) => visibleProjects(tx, "messages"));
    expect(seenByB).toEqual([b.projectId, b.projectId]);
    const after = await countAll(db);
    expect(after).toEqual({
      accounts: before.accounts,
      projects: before.projects - 1,
      widget_configs: before.widget_configs - 1,
      knowledge_sources: before.knowledge_sources - 1,
      knowledge_chunks: before.knowledge_chunks - 1,
      conversations: before.conversations - 1,
      messages: before.messages - 2,
    });
  });

  it("deleting an account deletes its projects", async () => {
    await asServiceRole(db, (tx) => tx.query("delete from public.accounts where clerk_user_id = $1", [OWNER_B]), {
      commit: true,
    });
    expect(await countAll(db)).toEqual({
      accounts: 1,
      projects: 0,
      widget_configs: 0,
      knowledge_sources: 0,
      knowledge_chunks: 0,
      conversations: 0,
      messages: 0,
    });
  });
});
