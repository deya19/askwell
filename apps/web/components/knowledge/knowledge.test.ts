import { APP_NAME, MAX_KNOWLEDGE_FILE_BYTES, PLAN_LIMITS } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import {
  FILE_EMPTY_MESSAGE,
  FILE_SIZE_MESSAGE,
  FILE_TYPE_MESSAGE,
  atSourceLimit,
  checkKnowledgeFile,
  isPending,
  knowledgePath,
  progressLabel,
  sourceCountLabel,
  sourceLimitMessage,
  statusLabel,
  typeLabel,
} from "./copy";

describe("checkKnowledgeFile", () => {
  it("accepts PDF, Markdown and TXT, with the MIME type from the extension", () => {
    expect(checkKnowledgeFile({ name: "guide.pdf", size: 10 })).toEqual({
      ok: true,
      type: "pdf",
      mimeType: "application/pdf",
    });
    expect(checkKnowledgeFile({ name: "README.MD", size: 10 })).toMatchObject({ ok: true, mimeType: "text/markdown" });
    expect(checkKnowledgeFile({ name: "notes.markdown", size: 10 })).toMatchObject({ ok: true, type: "md" });
    expect(checkKnowledgeFile({ name: "faq.txt", size: 10 })).toMatchObject({ ok: true, mimeType: "text/plain" });
  });

  it("refuses other types", () => {
    for (const name of ["report.docx", "image.png", "pdf", ".txt", "file.", "archive.pdf.zip"]) {
      expect(checkKnowledgeFile({ name, size: 10 })).toEqual({ ok: false, message: FILE_TYPE_MESSAGE });
    }
  });

  it("refuses files over 10 MB and accepts exactly 10 MB", () => {
    expect(checkKnowledgeFile({ name: "big.pdf", size: MAX_KNOWLEDGE_FILE_BYTES })).toMatchObject({ ok: true });
    expect(checkKnowledgeFile({ name: "big.pdf", size: 11 * 1024 * 1024 })).toEqual({
      ok: false,
      message: FILE_SIZE_MESSAGE,
    });
    expect(FILE_SIZE_MESSAGE).toBe("Files can be up to 10 MB.");
  });

  it("refuses an empty file", () => {
    expect(checkKnowledgeFile({ name: "empty.txt", size: 0 })).toEqual({ ok: false, message: FILE_EMPTY_MESSAGE });
  });
});

describe("statusLabel", () => {
  it("shows uploading as Processing (project.md §6.4)", () => {
    expect(statusLabel("uploading")).toBe("Processing");
    expect(statusLabel("processing")).toBe("Processing");
    expect(statusLabel("ready")).toBe("Ready");
    expect(statusLabel("failed")).toBe("Failed");
  });

  it("treats uploading and processing as pending", () => {
    expect(isPending("uploading")).toBe(true);
    expect(isPending("processing")).toBe(true);
    expect(isPending("ready")).toBe(false);
    expect(isPending("failed")).toBe(false);
  });
});

describe("typeLabel", () => {
  it("names each source type", () => {
    expect(typeLabel("text")).toBe("Text");
    expect(typeLabel("pdf")).toBe("PDF");
    expect(typeLabel("md")).toBe("Markdown");
    expect(typeLabel("txt")).toBe("TXT");
  });
});

describe("sourceCountLabel", () => {
  it("shows N of the plan's limit from PLAN_LIMITS", () => {
    expect(sourceCountLabel(0, "free")).toBe(`0 of ${PLAN_LIMITS.free.knowledgeSources} sources`);
    expect(sourceCountLabel(2, "free")).toBe("2 of 3 sources");
    expect(sourceCountLabel(7, "pro")).toBe(`7 of ${PLAN_LIMITS.pro.knowledgeSources} sources`);
  });
});

describe("atSourceLimit", () => {
  it("is true once the count reaches the plan's limit", () => {
    const free = PLAN_LIMITS.free.knowledgeSources;
    expect(atSourceLimit(free - 1, "free")).toBe(false);
    expect(atSourceLimit(free, "free")).toBe(true);
    expect(atSourceLimit(free, "pro")).toBe(false);
  });
});

describe("sourceLimitMessage", () => {
  it("states the Free limit and what Pro allows", () => {
    expect(sourceLimitMessage("free")).toBe(
      `The Free plan includes ${PLAN_LIMITS.free.knowledgeSources} knowledge sources per project. ${APP_NAME} Pro allows up to ${PLAN_LIMITS.pro.knowledgeSources}.`,
    );
  });

  it("tells Pro owners to delete one", () => {
    expect(sourceLimitMessage("pro")).toBe(
      `The Pro plan includes ${PLAN_LIMITS.pro.knowledgeSources} knowledge sources per project. Delete one to add another.`,
    );
  });
});

describe("progressLabel", () => {
  it("rounds to a whole percent and caps at 100", () => {
    expect(progressLabel(0, 0)).toBe("0%");
    expect(progressLabel(1, 3)).toBe("33%");
    expect(progressLabel(5, 4)).toBe("100%");
  });
});

describe("knowledgePath", () => {
  it("points at the project's Knowledge page", () => {
    expect(knowledgePath("6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f")).toBe(
      "/dashboard/projects/6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f/knowledge",
    );
  });
});
