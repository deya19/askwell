/** The plans an account can be on. The server decides which one applies (project.md §5). */
export type Plan = "free" | "pro";

export const PLANS = ["free", "pro"] as const satisfies readonly Plan[];

export type PlanLimits = {
  /** Projects per account. */
  projects: number;
  /** Accepted chat messages per project per month. */
  messagesPerMonth: number;
  /** Knowledge sources (files + pasted text) per project. */
  knowledgeSources: number;
  /** Whether the widget can be customized (color, position, label, animation, header). */
  customize: boolean;
  /** Whether the "Powered by" badge is shown. */
  showBadge: boolean;
};

/** The single source of plan limits. Read it on the server; never trust the client's plan. */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { projects: 1, messagesPerMonth: 100, knowledgeSources: 3, customize: false, showBadge: true },
  pro: { projects: 5, messagesPerMonth: 2000, knowledgeSources: 25, customize: true, showBadge: false },
};
