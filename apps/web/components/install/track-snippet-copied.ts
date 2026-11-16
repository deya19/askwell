import { getLoadedPostHog } from "@/lib/analytics/client";

/**
 * Sends `snippet_copied` (project.md §6.11) for a project. The browser is already identified
 * by the owner's Clerk user ID. Never throws, and does nothing when PostHog isn't loaded.
 */
export function trackSnippetCopied(projectId: string | undefined): void {
  try {
    getLoadedPostHog()?.capture("snippet_copied", projectId ? { project_id: projectId } : undefined);
  } catch (error) {
    console.warn('[analytics] Couldn\'t capture "snippet_copied"', error);
  }
}
