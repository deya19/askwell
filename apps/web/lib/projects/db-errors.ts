// The SQLSTATE codes the data functions raise. apps/web doesn't depend on @askwell/db,
// so this imports the one runtime constant it needs by path (no dependencies of its own).
export { DB_ERROR_CODES } from "../../../../packages/db/src/errors";
