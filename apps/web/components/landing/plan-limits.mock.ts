/**
 * TEMPORARY mock of `PLAN_LIMITS` from `@askwell/shared` (P1F-T01, not merged yet).
 * Same shape and values as project.md §5. Delete this file and import from
 * `@askwell/shared` before this PR merges.
 */
export type Plan = "free" | "pro";

export type PlanLimits = {
  projects: number;
  messagesPerMonth: number;
  knowledgeSources: number;
  customize: boolean;
  showBadge: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { projects: 1, messagesPerMonth: 100, knowledgeSources: 3, customize: false, showBadge: true },
  pro: { projects: 5, messagesPerMonth: 2000, knowledgeSources: 25, customize: true, showBadge: false },
};
