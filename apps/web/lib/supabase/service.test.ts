import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type ClientOptions = { auth?: Record<string, unknown> };

describe("service.ts", () => {
  afterEach(() => {
    vi.doUnmock("server-only");
    vi.doUnmock("@supabase/supabase-js");
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("can't be imported outside the server (server-only)", async () => {
    vi.resetModules();
    await expect(import("./service")).rejects.toThrow(
      "This module cannot be imported from a Client Component module",
    );
  });

  it("uses the secret key and never persists a session", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    const createClient = vi.fn<(url: string, key: string, options: ClientOptions) => object>(() => ({}));
    vi.doMock("@supabase/supabase-js", () => ({ createClient }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");

    const { createServiceClient } = await import("./service");
    createServiceClient();

    const call = createClient.mock.lastCall;
    expect(call?.[0]).toBe("https://example.supabase.co");
    expect(call?.[1]).toBe("sb_secret_test");
    expect(call?.[2].auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });
});

describe("SUPABASE_SECRET_KEY", () => {
  const webRoot = join(import.meta.dirname, "..", "..");
  const skip = new Set(["node_modules", ".next", "dist"]);

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      if (skip.has(name)) return [];
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx|js|jsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  }

  it("is read only in lib/supabase/service.ts", () => {
    const readers = sourceFiles(webRoot)
      .filter((file) => readFileSync(file, "utf8").includes("SUPABASE_SECRET_KEY"))
      .map((file) => relative(webRoot, file).replaceAll("\\", "/"));
    expect(readers).toEqual(["lib/supabase/service.ts"]);
  });
});
