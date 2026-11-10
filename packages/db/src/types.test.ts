import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../supabase-pglite";

/** The column names in one table's `Row` block of the generated types. */
function rowColumns(types: string, table: string): string[] {
  const match = types.match(new RegExp(`\\n      ${table}: \\{\\n        Row: \\{\\n([\\s\\S]*?)\\n        \\};`));
  if (!match?.[1]) return [];
  return [...match[1].matchAll(/^\s+(\w+): /gm)].map((m) => m[1]!).sort();
}

describe("types.ts", () => {
  it("has the same tables and columns as the migrated schema", async () => {
    const types = await readFile(fileURLToPath(new URL("../types.ts", import.meta.url)), "utf8");
    const db = await createTestDatabase();
    const result = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public' order by table_name, column_name`,
    );
    await db.close();

    const schema = new Map<string, string[]>();
    for (const row of result.rows) schema.set(row.table_name, [...(schema.get(row.table_name) ?? []), row.column_name]);

    const typedTables = [...types.matchAll(/^      (\w+): \{\n        Row: \{/gm)].map((m) => m[1]!).sort();
    expect(typedTables).toEqual([...schema.keys()].sort());
    for (const [table, columns] of schema) expect(rowColumns(types, table), table).toEqual(columns.sort());
  }, 60_000);
});
