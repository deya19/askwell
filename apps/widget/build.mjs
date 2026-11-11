// Builds widget.js (minified IIFE) into dist/ and into apps/web/public/, so the web app
// serves it at /widget.js on every deploy. Both outputs are gitignored.
//   node build.mjs           build once
//   node build.mjs --watch   rebuild on change (pnpm dev)
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { context } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const outfiles = [resolve(here, "dist/widget.js"), resolve(here, "../web/public/widget.js")];
const watch = process.argv.includes("--watch");

const contexts = await Promise.all(
  outfiles.map((outfile) => {
    mkdirSync(dirname(outfile), { recursive: true });
    return context({
      entryPoints: [resolve(here, "src/index.ts")],
      outfile,
      bundle: true,
      minify: true,
      format: "iife",
      target: "es2018",
      legalComments: "none",
      logLevel: "info",
    });
  }),
);

if (watch) {
  await Promise.all(contexts.map((ctx) => ctx.watch()));
} else {
  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
}
