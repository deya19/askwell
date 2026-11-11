/**
 * Errors the data functions raise on purpose (supabase/migrations/*_functions.sql).
 * supabase-js puts the SQLSTATE in `error.code` and the name in `error.message`.
 */
export const DB_ERROR_CODES = {
  /** `create_project`: the owner already has their plan's number of projects. */
  projectLimitReached: "AWL01",
  /** `reserve_knowledge_source`: the project already has its plan's number of sources. */
  sourceLimitReached: "AWL02",
  /** The account, project or conversation doesn't exist (or isn't in the given project). */
  notFound: "P0002",
} as const;

export type DbErrorCode = (typeof DB_ERROR_CODES)[keyof typeof DB_ERROR_CODES];
