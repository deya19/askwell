/**
 * The product events we capture (project.md §6.11). Names are part of the analytics
 * contract: the funnel and dashboards in PostHog match on them, so never rename one.
 */
export const ANALYTICS_EVENTS = [
  "signed_up",
  "project_created",
  "knowledge_added",
  "snippet_copied",
  "first_chat",
  "upgraded",
  "message_blocked",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
