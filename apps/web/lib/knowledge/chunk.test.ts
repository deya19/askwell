import { describe, expect, it } from "vitest";
import { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS, CHUNK_TARGET_CHARS, chunkText, normalizeText } from "./chunk";

/** `count` distinct sentences of ~60 characters each. */
function sentences(count: number, prefix = "Sentence"): string {
  return Array.from({ length: count }, (_, i) => `${prefix} ${i} talks about the refund policy in detail.`).join(" ");
}

/** True if `text` contains a lone (unpaired) surrogate. */
function hasLoneSurrogate(text: string): boolean {
  return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
}

describe("normalizeText", () => {
  it("collapses spaces and tabs, trims lines and keeps at most one blank line", () => {
    expect(normalizeText("  Hello\t\t world  \r\n\r\n\r\n\r\nNext   line \n")).toBe("Hello world\n\nNext line");
  });

  it("normalizes unicode to NFC and drops zero-width characters", () => {
    expect(normalizeText("Café​﻿")).toBe("Café");
  });
});

describe("chunkText", () => {
  it("returns no chunks for empty or whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText(" \n\n\t \r\n ")).toEqual([]);
  });

  it("keeps short text as one normalized chunk", () => {
    expect(chunkText("  We ship   worldwide.\n\n\n\nReturns take 30 days.  ")).toEqual([
      "We ship worldwide.\n\nReturns take 30 days.",
    ]);
  });

  it("splits long text into chunks of roughly 800–1,000 tokens", () => {
    const text = Array.from({ length: 40 }, (_, p) => sentences(8, `P${p}`)).join("\n\n");
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
    // Every chunk but the last is at least ~800 tokens' worth minus one paragraph.
    for (const chunk of chunks.slice(0, -1)) expect(chunk.length).toBeGreaterThan(CHUNK_TARGET_CHARS - 600);
  });

  it("splits on paragraph and sentence boundaries, not mid-word", () => {
    const text = Array.from({ length: 30 }, (_, p) => sentences(6, `P${p}`)).join("\n\n");
    for (const chunk of chunkText(text)) {
      expect(chunk.endsWith(".")).toBe(true);
    }
  });

  it("splits one huge paragraph on sentences", () => {
    const chunks = chunkText(sentences(300));
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
      expect(chunk.endsWith(".")).toBe(true);
    }
  });

  it("repeats a small overlap from the end of each chunk at the start of the next", () => {
    const chunks = chunkText(sentences(300));
    chunks.slice(1).forEach((chunk, i) => {
      const previous = chunks[i] ?? "";
      expect(previous.slice(-CHUNK_OVERLAP_CHARS - 1)).toContain(chunk.slice(0, 40));
    });
  });

  it("loses no content: every sentence appears in some chunk", () => {
    const text = Array.from({ length: 25 }, (_, p) => sentences(7, `P${p}`)).join("\n\n");
    const all = chunkText(text).join("\n");
    for (let p = 0; p < 25; p++) {
      for (let i = 0; i < 7; i++) expect(all).toContain(`P${p} ${i} talks about`);
    }
  });

  it("never returns an empty chunk or a chunk that is only overlap", () => {
    const text = `${sentences(200)}\n\n\n\n   \n\n${sentences(3, "Tail")}`;
    const chunks = chunkText(text);
    for (const chunk of chunks) expect(chunk.trim().length).toBeGreaterThan(0);
    // The last chunk adds text beyond the previous chunk.
    expect(chunks.at(-2)?.endsWith(chunks.at(-1) ?? "")).toBe(false);
  });

  it("hard-splits a run with no spaces or sentence ends", () => {
    const chunks = chunkText("x".repeat(CHUNK_MAX_CHARS * 3));
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
  });

  it("handles unicode: CJK sentences and emoji are never cut in half", () => {
    const cjk = "我们提供全球配送服务，退货期为三十天。".repeat(400);
    const emoji = "😀".repeat(CHUNK_MAX_CHARS);
    for (const chunk of [...chunkText(cjk), ...chunkText(emoji)]) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
      expect(hasLoneSurrogate(chunk)).toBe(false);
    }
    expect(chunkText("Ünïcödé café — naïve 😀.")).toEqual(["Ünïcödé café — naïve 😀."]);
  });

  it("is deterministic", () => {
    const text = sentences(150);
    expect(chunkText(text)).toEqual(chunkText(text));
  });
});
