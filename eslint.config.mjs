import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["**/node_modules/", "**/.next/", "**/dist/", "**/next-env.d.ts", "apps/web/public/widget.js"]),
  tseslint.configs.recommended,
  {
    files: ["apps/web/**/*.{js,mjs,ts,tsx}"],
    extends: [nextCoreWebVitals],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
]);
