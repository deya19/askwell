import "server-only";
import OpenAI from "openai";
import { requireEnv } from "../supabase/env";

let cached: { key: string; client: OpenAI } | null = null;

/**
 * The one OpenAI client (project.md §12: one LLM provider).
 *
 * Server only. The only file that reads `OPENAI_API_KEY` (project.md §9). The key is read at
 * call time, so a missing key fails loudly on first use, not at import or build.
 */
export function getOpenAI(): OpenAI {
  const key = requireEnv("OPENAI_API_KEY");
  if (cached?.key !== key) cached = { key, client: new OpenAI({ apiKey: key }) };
  return cached.client;
}
