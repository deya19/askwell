import "server-only";

/**
 * The OpenAI models Askwell uses (project.md §12: one LLM provider). Change them here only.
 */

/**
 * Embeds knowledge chunks and visitor questions. Its 1536 dimensions match the
 * `knowledge_chunks.embedding vector(1536)` column and `match_chunks`.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Writes the bot's answers (§6.6 step 5). OpenAI's most efficient current model for
 * high-volume work; it took the place of the "mini" tier (product owner, 2026-11-13).
 * https://developers.openai.com/api/docs/models/gpt-6-luna
 */
export const CHAT_MODEL = "gpt-6-luna";
