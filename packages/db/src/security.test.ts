/**
 * §9 "Database API" audit, run over the whole migrated catalog rather than a fixed list of
 * names, so a table, view or function added by a later migration is checked too.
 *
 * The Data API is public: RLS and grants are the boundary (project.md §7, §9).
 */
import { readdir, readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_DIR, createTestDatabase } from "../supabase-pglite";

/** Booting pglite and migrating takes a few seconds, more when test files run in parallel. */
const BOOT_TIMEOUT = 60_000;

/** Schemas our migrations own. `public` is exposed by the Data API; `private` holds helpers. */
const OUR_SCHEMAS = ["public", "private"];
const API_ROLES = ["anon", "authenticated", "service_role"] as const;

/** The only SECURITY DEFINER functions §9 allows: the RLS helpers. */
const DEFINER_ALLOWED = ["private.owned_conversation_ids", "private.owned_project_ids"];

/** What `authenticated` may execute (§7): owner_activity, the RLS helpers, and the period helper owner_activity reads. */
const AUTHENTICATED_EXECUTE = [
  "private.current_period_start",
  "private.owned_conversation_ids",
  "private.owned_project_ids",
  "public.owner_activity",
];

/** Functions and relations created by extensions (pgvector) are theirs, not ours. */
const NOT_EXTENSION_MEMBER = `not exists (
  select 1 from pg_depend d where d.objid = %s and d.deptype = 'e'
)`;

type Fn = { name: string; signature: string; prosecdef: boolean; proconfig: string[] | null; acl: string[] | null };
type Relation = { name: string; relkind: string; relrowsecurity: boolean; reloptions: string[] | null };

let db: PGlite;
let functions: Fn[];
let relations: Relation[];

beforeAll(async () => {
  db = await createTestDatabase();
  functions = (
    await db.query<Fn>(
      `select n.nspname || '.' || p.proname as name, p.oid::regprocedure::text as signature,
              p.prosecdef, p.proconfig, p.proacl::text[] as acl
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = any($1) and ${NOT_EXTENSION_MEMBER.replace("%s", "p.oid")}
       order by 1`,
      [OUR_SCHEMAS],
    )
  ).rows;
  relations = (
    await db.query<Relation>(
      `select n.nspname || '.' || c.relname as name, c.relkind::text as relkind, c.relrowsecurity, c.reloptions
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = any($1) and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
         and ${NOT_EXTENSION_MEMBER.replace("%s", "c.oid")}
       order by 1`,
      [OUR_SCHEMAS],
    )
  ).rows;
}, BOOT_TIMEOUT);

afterAll(async () => {
  await db.close();
});

describe("§9 Database API: tables and views", () => {
  it("finds the schema to audit", () => {
    expect(relations.filter((r) => r.relkind === "r").length).toBeGreaterThanOrEqual(7);
    expect(functions.length).toBeGreaterThanOrEqual(9);
  });

  it("enables RLS on every table in public and private", () => {
    for (const table of relations.filter((r) => r.relkind === "r" || r.relkind === "p")) {
      expect(table.relrowsecurity, table.name).toBe(true);
    }
  });

  it("gives every public table at least one policy, and no policy to anon or PUBLIC", async () => {
    const tables = relations.filter((r) => (r.relkind === "r" || r.relkind === "p") && r.name.startsWith("public."));
    for (const table of tables) {
      const policies = await db.query<{ roles: string[] }>(
        `select array(select case when r = 0 then 'public' else r::regrole::text end from unnest(polroles) r) as roles
         from pg_policy where polrelid = $1::regclass`,
        [table.name],
      );
      expect(policies.rows.length, `${table.name} policies`).toBeGreaterThan(0);
      for (const policy of policies.rows) {
        expect(policy.roles, table.name).not.toContain("anon");
        expect(policy.roles, table.name).not.toContain("public");
      }
    }
  });

  it("makes any view or materialized view run as the caller (security_invoker), so it can't skip RLS", () => {
    for (const view of relations.filter((r) => r.relkind === "v")) {
      expect(view.reloptions ?? [], view.name).toContain("security_invoker=true");
    }
    // A materialized view has no RLS at all: never expose one.
    expect(relations.filter((r) => r.relkind === "m").map((r) => r.name)).toEqual([]);
  });

  it("grants anon nothing on any table, view or sequence", async () => {
    for (const relation of relations) {
      const privileges = relation.relkind === "S" ? "USAGE,SELECT,UPDATE" : "SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER";
      const result = await db.query<{ ok: boolean }>(
        relation.relkind === "S"
          ? "select has_sequence_privilege('anon', $1, $2) as ok"
          : "select has_table_privilege('anon', $1, $2) as ok",
        [relation.name, privileges],
      );
      expect(result.rows[0]!.ok, `anon on ${relation.name}`).toBe(false);
      const column = await db.query<{ ok: boolean }>(
        "select has_any_column_privilege('anon', $1, 'SELECT,INSERT,UPDATE,REFERENCES') as ok",
        [relation.name],
      );
      if (relation.relkind !== "S") expect(column.rows[0]!.ok, `anon columns of ${relation.name}`).toBe(false);
    }
  });

  it("grants no API role TRUNCATE on anything", async () => {
    for (const relation of relations.filter((r) => r.relkind !== "S")) {
      for (const role of API_ROLES) {
        const result = await db.query<{ ok: boolean }>("select has_table_privilege($1, $2, 'TRUNCATE') as ok", [
          role,
          relation.name,
        ]);
        expect(result.rows[0]!.ok, `${role} TRUNCATE ${relation.name}`).toBe(false);
      }
    }
  });

  it("keeps the private schema closed to anon", async () => {
    const result = await db.query<{ ok: boolean }>("select has_schema_privilege('anon', 'private', 'USAGE') as ok");
    expect(result.rows[0]!.ok).toBe(false);
  });
});

describe("§9 Database API: functions", () => {
  it("makes every function SECURITY INVOKER, except the RLS helpers", () => {
    expect(functions.filter((fn) => fn.prosecdef).map((fn) => fn.name)).toEqual(DEFINER_ALLOWED);
  });

  it("pins every function's search_path to ''", () => {
    for (const fn of functions) expect(fn.proconfig, fn.signature).toEqual(['search_path=""']);
  });

  it("grants EXECUTE to neither PUBLIC nor anon", async () => {
    for (const fn of functions) {
      // A PUBLIC grant shows as an ACL entry with an empty grantee ("=X/owner"). A null ACL
      // means the default, which includes PUBLIC EXECUTE: that fails too.
      expect(fn.acl, `${fn.signature} has the default ACL`).not.toBeNull();
      expect(fn.acl!.some((entry) => entry.startsWith("=")), `PUBLIC on ${fn.signature}`).toBe(false);
      const anon = await db.query<{ ok: boolean }>("select has_function_privilege('anon', $1, 'EXECUTE') as ok", [
        fn.signature,
      ]);
      expect(anon.rows[0]!.ok, `anon on ${fn.signature}`).toBe(false);
    }
  });

  it("lets authenticated execute only owner_activity and the helpers it needs", async () => {
    const allowed: string[] = [];
    for (const fn of functions) {
      const result = await db.query<{ ok: boolean }>(
        "select has_function_privilege('authenticated', $1, 'EXECUTE') as ok",
        [fn.signature],
      );
      if (result.rows[0]!.ok) allowed.push(fn.name);
    }
    expect(allowed.sort()).toEqual(AUTHENTICATED_EXECUTE);
  });
});

describe("§9 Database API: PostgREST settings", () => {
  it("no migration turns on aggregates (or any PostgREST setting) project-wide", async () => {
    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const sql = await readFile(`${MIGRATIONS_DIR}/${file}`, "utf8");
      expect(sql, file).not.toMatch(/db_aggregates_enabled|pgrst\./i);
    }
  });
});
