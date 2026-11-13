/**
 * Splits extracted document text into chunks for embedding (project.md §6.4 Processing).
 *
 * Pure. Sizes are in characters, approximating tokens at ~4 characters per token:
 * a chunk is at most ~1,000 tokens and aims for ~800+; consecutive chunks share a small overlap
 * so a fact split across a boundary is still found.
 */

/** ~1,000 tokens. No chunk is longer. */
export const CHUNK_MAX_CHARS = 4000;
/** ~800 tokens. A chunk closes at the first boundary past this size. */
export const CHUNK_TARGET_CHARS = 3200;
/** ~50 tokens of the previous chunk repeated at the start of the next one. */
export const CHUNK_OVERLAP_CHARS = 200;

/** The largest piece packed in one go, so overlap + piece always fits in a chunk. */
const PIECE_MAX_CHARS = CHUNK_MAX_CHARS - CHUNK_OVERLAP_CHARS - 2;

const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });

/** Unicode NFC, `\n` line ends, single spaces, at most one blank line between paragraphs. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[​﻿]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const paragraphs = normalized.split("\n\n");
  const chunks: string[] = [];
  let current = "";
  // True while `current` holds only the overlap copied from the last chunk.
  let onlyOverlap = false;

  const close = () => {
    chunks.push(current);
    current = overlapTail(current);
    onlyOverlap = true;
  };

  for (const paragraph of paragraphs) {
    const pieces = paragraph.length <= PIECE_MAX_CHARS ? [paragraph] : splitLong(paragraph);
    pieces.forEach((piece, i) => {
      const separator = i === 0 ? "\n\n" : " ";
      if (current && current.length + separator.length + piece.length > CHUNK_MAX_CHARS) close();
      current = current ? current + separator + piece : piece;
      onlyOverlap = false;
      if (current.length >= CHUNK_TARGET_CHARS) close();
    });
  }

  if (current && !onlyOverlap) chunks.push(current);
  return chunks.map((chunk) => chunk.trim()).filter((chunk) => chunk.length > 0);
}

/** Splits a paragraph too long for one piece on sentences, then words, then code points. */
function splitLong(paragraph: string): string[] {
  const sentences = Array.from(sentenceSegmenter.segment(paragraph), (s) => s.segment.trim()).filter(Boolean);
  const pieces: string[] = [];
  let current = "";

  const push = (unit: string) => {
    if (current && current.length + 1 + unit.length > PIECE_MAX_CHARS) {
      pieces.push(current);
      current = "";
    }
    current = current ? `${current} ${unit}` : unit;
  };

  for (const sentence of sentences) {
    if (sentence.length <= PIECE_MAX_CHARS) {
      push(sentence);
      continue;
    }
    for (const word of sentence.split(" ")) {
      if (word.length <= PIECE_MAX_CHARS) push(word);
      else hardSplit(word).forEach(push);
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** Cuts text with no spaces into pieces by code point, so no surrogate pair is broken. */
function hardSplit(word: string): string[] {
  const codePoints = Array.from(word);
  const pieces: string[] = [];
  let piece = "";
  for (const cp of codePoints) {
    if (piece.length + cp.length > PIECE_MAX_CHARS) {
      pieces.push(piece);
      piece = "";
    }
    piece += cp;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

/** The last ~CHUNK_OVERLAP_CHARS of a chunk, starting at a word boundary when there is one. */
function overlapTail(chunk: string): string {
  if (chunk.length <= CHUNK_OVERLAP_CHARS) return chunk;
  let tail = chunk.slice(-CHUNK_OVERLAP_CHARS);
  // Don't start on the low half of a surrogate pair.
  if (/^[\uDC00-\uDFFF]/.test(tail)) tail = tail.slice(1);
  const space = tail.search(/\s/);
  if (space !== -1 && space < tail.length - 1) tail = tail.slice(space + 1);
  return tail.trim();
}
