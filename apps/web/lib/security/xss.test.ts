/**
 * §9 XSS: visitor messages and bot replies render as text, never HTML, in the widget, the
 * /embed panel and the dashboard.
 *
 * 1. No HTML sink anywhere in the web app or widget source, except two that only ever take
 *    fixed markup (checked below). A new sink fails this test and needs a review.
 * 2. The dashboard thread and the /embed panel render message text as React text children.
 * The widget loader's own check (config text as text) is in apps/widget/src/loader.test.ts.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const SCANNED = ["apps/web/app", "apps/web/components", "apps/web/lib", "apps/widget/src"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist"]);

/** Anything that parses a string as HTML. */
const HTML_SINK = /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|srcdoc/;

/** The only allowed sinks, each fed a module constant, never data. File → the exact line. */
const ALLOWED_SINKS: Record<string, RegExp> = {
  "apps/web/components/dashboard/theme.tsx": /dangerouslySetInnerHTML=\{\{ __html: THEME_SCRIPT \}\}/,
  "apps/widget/src/loader.ts": /button\.innerHTML = CHAT_ICON;/,
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("§9 XSS", () => {
  it("has no HTML sink except the two that take fixed markup", () => {
    const found: string[] = [];
    for (const file of SCANNED.flatMap((dir) => sourceFiles(join(repoRoot, dir)))) {
      const path = relative(repoRoot, file).replaceAll("\\", "/");
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.trim();
          if (code.startsWith("*") || code.startsWith("//") || code.startsWith("/*")) return; // Comments.
          if (!HTML_SINK.test(line)) return;
          const allowed = ALLOWED_SINKS[path];
          if (allowed?.test(line)) return;
          found.push(`${path}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });

  it("feeds the allowed sinks constants built from no data", async () => {
    // CHAT_ICON: a plain string literal.
    const loader = readFileSync(join(repoRoot, "apps/widget/src/loader.ts"), "utf8");
    expect(loader).toMatch(/const CHAT_ICON =\s*'[^'$]*';/);

    // THEME_SCRIPT: a template whose only interpolations are two module constants.
    const theme = readFileSync(join(repoRoot, "apps/web/lib/theme/theme.ts"), "utf8");
    const line = theme.split("\n").find((l) => l.startsWith("export const THEME_SCRIPT = `"));
    expect(line).toBeDefined();
    const interpolations = [...line!.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]);
    expect(interpolations).toEqual(["JSON.stringify(THEME_STORAGE_KEY)", "JSON.stringify(DARK_MEDIA_QUERY)"]);
    const { THEME_SCRIPT } = await import("../theme/theme");
    expect(THEME_SCRIPT).not.toMatch(/<\//);
  });

  it("puts visitor messages and bot replies into the page as JSX text children", () => {
    // React escapes text children. With no sink in these files (test above), this is the only
    // way the text reaches the DOM.
    const renders: Record<string, RegExp> = {
      "apps/web/components/conversations/thread-view.tsx": /^\s*\{message\.body\}$/m,
      "apps/web/components/embed/chat-panel.tsx": /^\s*\{item\.text\}$/m,
    };
    for (const [path, pattern] of Object.entries(renders)) {
      expect(readFileSync(join(repoRoot, path), "utf8"), path).toMatch(pattern);
    }
  });
});
