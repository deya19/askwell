import "server-only";
import { KNOWLEDGE_BUCKET } from "./source";

/** Objects per `list` page and per `remove` call. */
export const PROJECT_FILES_PAGE_SIZE = 100;

/** A Storage listing entry. Folders come back with a null `id`. */
type ListEntry = { name: string; id: string | null };

type StorageBucket = {
  list(
    path: string,
    options: { limit: number; offset: number; sortBy: { column: string; order: string } },
  ): Promise<{ data: ListEntry[] | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
};

/** The Storage part of the service client (`ServiceClient` fits it), so tests can pass a small fake. */
export type ProjectFilesClient = { storage: { from(bucket: string): StorageBucket } };

/**
 * Every object path under `<projectId>/` in the knowledge bucket. Uploads are stored flat as
 * `<projectId>/<objectId>.<type>` (`storageKeyFor`), so one folder level is all there is.
 * Pages through the listing, since a project can hold more files than one page.
 */
export async function listProjectFiles(client: ProjectFilesClient, projectId: string): Promise<string[]> {
  const bucket = client.storage.from(KNOWLEDGE_BUCKET);
  const paths: string[] = [];
  for (let offset = 0; ; offset += PROJECT_FILES_PAGE_SIZE) {
    const { data, error } = await bucket.list(projectId, {
      limit: PROJECT_FILES_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Could not list project files: ${error.message}`);
    const page = data ?? [];
    for (const entry of page) {
      if (entry.id !== null) paths.push(`${projectId}/${entry.name}`);
    }
    if (page.length < PROJECT_FILES_PAGE_SIZE) return paths;
  }
}

/**
 * Removes every file the project has in the knowledge bucket. Call it with the service
 * client only after the caller's ownership of the project is proven (project.md §9).
 * Returns how many files were removed. Throws on a Storage error.
 */
export async function removeProjectFiles(client: ProjectFilesClient, projectId: string): Promise<number> {
  const paths = await listProjectFiles(client, projectId);
  const bucket = client.storage.from(KNOWLEDGE_BUCKET);
  for (let i = 0; i < paths.length; i += PROJECT_FILES_PAGE_SIZE) {
    const { error } = await bucket.remove(paths.slice(i, i + PROJECT_FILES_PAGE_SIZE));
    if (error) throw new Error(`Could not remove project files: ${error.message}`);
  }
  return paths.length;
}
