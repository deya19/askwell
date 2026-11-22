/**
 * §9 Tenant leak: owner reads go through the owner client (RLS), never the service client
 * with a manual owner filter. A file that creates a service client must not filter on
 * `owner_id`. (Writes to `accounts` by `clerk_user_id` in lib/accounts.ts are the Clerk
 * webhook and first sign-in, both keyed by a server-verified user ID, not owner reads.)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".next", "public"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("§9 Tenant leak", () => {
  const serviceFiles = sourceFiles(webRoot)
    .filter((file) => readFileSync(file, "utf8").includes("createServiceClient("))
    .map((file) => relative(webRoot, file).replaceAll("\\", "/"));

  it("finds the service-client users", () => {
    expect(serviceFiles).toContain("lib/chat/steps.ts");
  });

  it("never filters a service-client query by owner", () => {
    const offenders = serviceFiles.filter((file) =>
      /\.(eq|match|in|filter)\(\s*["'`]owner_id["'`]/.test(readFileSync(join(webRoot, file), "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("reads accounts by clerk_user_id with the service client only in lib/accounts.ts (webhook + first sign-in writes)", () => {
    const offenders = serviceFiles.filter(
      (file) => file !== "lib/accounts.ts" && /["'`]clerk_user_id["'`]/.test(readFileSync(join(webRoot, file), "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
