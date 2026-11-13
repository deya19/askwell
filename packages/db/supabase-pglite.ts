/**
 * Test helper: an in-memory Postgres (pglite) shaped like a Supabase database.
 *
 * It stubs what our migrations and policies rely on: the `anon`, `authenticated` and
 * `service_role` roles, the `auth` and `extensions` schemas, `auth.jwt()` (read from the
 * `request.jwt.claims` setting, as PostgREST sets it), pgvector, Supabase's default
 * grants on new objects in `public` (so tests prove our migrations revoke them), and the
 * Storage tables our migrations touch (`storage.buckets`, `storage.objects` with RLS on).
 *
 * Never point tests at a local Supabase stack or the shared dev project (project.md §4).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../../supabase/migrations", import.meta.url));

const SUPABASE_STUB_SQL = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema extensions;
  create schema auth;

  grant usage on schema public, extensions, auth to anon, authenticated, service_role;

  -- Like Supabase's auth.jwt(): the request's JWT claims, or an empty object.
  create function auth.jwt() returns jsonb
  language sql stable
  as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant execute on function auth.jwt() to anon, authenticated, service_role;

  -- Supabase grants everything on new objects in public to the API roles by default.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

  -- A cut-down Supabase Storage schema: the bucket columns our migrations set, and
  -- storage.objects with RLS on and the API roles granted, as on a real project.
  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key,
    name text not null unique,
    owner uuid,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner_id text,
    metadata jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
`;

/** A fresh pglite with Supabase's roles, schemas and `auth.jwt()` stubbed. No migrations applied. */
export async function createSupabasePglite(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { vector } });
  await db.exec(SUPABASE_STUB_SQL);
  return db;
}

/** Applies every migration in `supabase/migrations`, in file-name (timestamp) order. */
export async function applyMigrations(db: PGlite, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(`${dir}/${file}`, "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  }
  return files;
}

/** A fresh Supabase-shaped pglite with every migration applied. */
export async function createTestDatabase(): Promise<PGlite> {
  const db = await createSupabasePglite();
  await applyMigrations(db);
  return db;
}

export type ApiRole = "anon" | "authenticated" | "service_role";

/**
 * Runs `fn` in a transaction as an API role with the given JWT claims, the way a Data API
 * request would. The transaction is always rolled back unless `commit` is true, so tests
 * can try writes without changing shared fixtures.
 */
export async function withRole<T>(
  db: PGlite,
  role: ApiRole,
  claims: Record<string, unknown>,
  fn: (tx: Transaction) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  let result: T | undefined;
  await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role, ...claims })]);
    // Role names come from the closed ApiRole union, never from input.
    await tx.exec(`set local role ${role}`);
    result = await fn(tx);
    if (!commit) await tx.rollback();
  });
  return result as T;
}

/** Runs `fn` as a signed-in owner: `authenticated` with Clerk user ID `sub`. */
export function asUser<T>(
  db: PGlite,
  sub: string,
  fn: (tx: Transaction) => Promise<T>,
  options?: { commit?: boolean },
): Promise<T> {
  return withRole(db, "authenticated", { sub }, fn, options);
}

/** Runs `fn` as `anon` (no token). */
export function asAnon<T>(db: PGlite, fn: (tx: Transaction) => Promise<T>, options?: { commit?: boolean }): Promise<T> {
  return withRole(db, "anon", {}, fn, options);
}

/** Runs `fn` as `service_role` (the server's secret key). */
export function asServiceRole<T>(
  db: PGlite,
  fn: (tx: Transaction) => Promise<T>,
  options?: { commit?: boolean },
): Promise<T> {
  return withRole(db, "service_role", {}, fn, options);
}
