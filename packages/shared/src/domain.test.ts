import { describe, expect, test } from "vitest";
import {
  knowledgeFileTypeFromName,
  knowledgeSourceStatusSchema,
  knowledgeSourceTypeSchema,
  messageRoleSchema,
} from "./domain";

describe("domain enums", () => {
  test("accept the values in project.md §7", () => {
    for (const type of ["text", "pdf", "md", "txt"]) expect(knowledgeSourceTypeSchema.parse(type)).toBe(type);
    for (const status of ["uploading", "processing", "ready", "failed"])
      expect(knowledgeSourceStatusSchema.parse(status)).toBe(status);
    for (const role of ["visitor", "bot"]) expect(messageRoleSchema.parse(role)).toBe(role);
  });

  test("reject other values", () => {
    expect(knowledgeSourceTypeSchema.safeParse("docx").success).toBe(false);
    expect(knowledgeSourceStatusSchema.safeParse("done").success).toBe(false);
    expect(messageRoleSchema.safeParse("assistant").success).toBe(false);
  });
});

describe("knowledgeFileTypeFromName", () => {
  test.each([
    ["guide.pdf", "pdf"],
    ["GUIDE.PDF", "pdf"],
    ["notes.md", "md"],
    ["notes.markdown", "md"],
    ["faq.txt", "txt"],
    ["archive.tar.txt", "txt"],
  ])("%s → %s", (name, type) => {
    expect(knowledgeFileTypeFromName(name)).toBe(type);
  });

  test.each(["report.docx", "noextension", ".pdf", "trailing.", "image.png", "x.constructor", "x.__proto__"])(
    "%s → null",
    (name) => {
      expect(knowledgeFileTypeFromName(name)).toBeNull();
    },
  );
});
