import type { Plan } from "@askwell/shared";
import type { ReactNode } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PLAN_NAMES, planHighlights } from "./billing-state";

/** The owner's current plan (read on the server) and what it includes. */
export function CurrentPlan({ plan, action }: { plan: Plan; action?: ReactNode }) {
  return (
    <GlassPanel as="section" aria-labelledby="current-plan" className="mt-8 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted">Current plan</p>
          <h2 id="current-plan" className="mt-1 text-xl font-semibold tracking-tight">
            {PLAN_NAMES[plan]}
          </h2>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
        {planHighlights(plan).map((line) => (
          <li key={line} className="flex items-start gap-2">
            <CheckIcon />
            <span className="min-w-0">{line}</span>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
