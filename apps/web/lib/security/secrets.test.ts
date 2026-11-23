/**
 * §9 Secrets: no secret in `NEXT_PUBLIC_*`. Next.js inlines every `NEXT_PUBLIC_*` variable into
 * the browser bundle, so only the public values in project.md §11 may use the prefix.
 * (`SUPABASE_SECRET_KEY` staying in lib/supabase/service.ts is tested in service.test.ts; the
 * widget bundle is scanned in apps/widget/src/bundle.test.ts.)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const SCANNED = ["apps/web", "apps/widget", "packages"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "public"]);

/** project.md §11: the public variables. Publishable keys, URLs and the app URL only. */
const PUBLIC_VARIABLES = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs|json)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("§9 Secrets: NEXT_PUBLIC_*", () => {
  const uses = new Map<string, string[]>();
  for (const file of SCANNED.flatMap((dir) => sourceFiles(join(repoRoot, dir)))) {
    for (const match of readFileSync(file, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
      const where = uses.get(match[0]) ?? [];
      where.push(relative(repoRoot, file).replaceAll("\\", "/"));
      uses.set(match[0], where);
    }
  }

  it("uses only the public variables from project.md §11", () => {
    expect(uses.size).toBeGreaterThan(0);
    const unexpected = [...uses].filter(([name]) => !PUBLIC_VARIABLES.includes(name));
    expect(unexpected).toEqual([]);
  });

  it("has no NEXT_PUBLIC_ name that looks like a secret", () => {
    for (const name of uses.keys()) {
      expect(name, name).not.toMatch(/SECRET|PRIVATE|TOKEN|PASSWORD|SERVICE_ROLE|SIGNING|WEBHOOK|OPENAI|ARCJET/);
    }
  });
});
