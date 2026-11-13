import { knowledgeSourceSchema } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { looksLikePdf, storageKeyFor, titleFromFileName, toKnowledgeSource } from "./source";

describe("toKnowledgeSource", () => {
  it("maps a row to a valid KnowledgeSource without the storage key", () => {
    const source = toKnowledgeSource({
      id: "11111111-1111-4111-8111-111111111111",
      project_id: "22222222-2222-4222-8222-222222222222",
      title: "FAQ",
      type: "pdf",
      status: "uploading",
      storage_key: "22222222-2222-4222-8222-222222222222/abc.pdf",
      created_at: "2026-11-13T10:00:00.123456+00:00",
    });
    expect(knowledgeSourceSchema.parse(source)).toEqual(source);
    expect(source).not.toHaveProperty("storage_key");
    expect(source).not.toHaveProperty("storageKey");
  });

  it("throws on a status it doesn't know", () => {
    expect(() =>
      toKnowledgeSource({
        id: "11111111-1111-4111-8111-111111111111",
        project_id: "22222222-2222-4222-8222-222222222222",
        title: "FAQ",
        type: "text",
        status: "weird",
        storage_key: null,
        created_at: "2026-11-13T10:00:00+00:00",
      }),
    ).toThrow();
  });
});

describe("storageKeyFor", () => {
  it("puts the object under the project", () => {
    expect(storageKeyFor("p1", "o1", "md")).toBe("p1/o1.md");
  });
});

describe("titleFromFileName", () => {
  it("cuts long names without breaking a character", () => {
    const title = titleFromFileName(`${"😀".repeat(250)}.pdf`, 200);
    expect(Array.from(title)).toHaveLength(200);
    expect(title).toBe("😀".repeat(200));
  });

  it("keeps short names", () => {
    expect(titleFromFileName("  FAQ.pdf ", 200)).toBe("FAQ.pdf");
  });
});

describe("looksLikePdf", () => {
  it("checks the %PDF- header", () => {
    expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n..."))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode("<html>%PDF-"))).toBe(false);
    expect(looksLikePdf(new TextEncoder().encode("%PDF"))).toBe(false);
    expect(looksLikePdf(new Uint8Array())).toBe(false);
  });
});
