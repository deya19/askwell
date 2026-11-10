import type { PlanLimits } from "@askwell/shared";

export type PricingRow = { label: string; free: string; pro: string };

/** Monthly price in US dollars per plan. Product-owner decision, 2026-11-10 (project.md §5). */
export const PLAN_PRICES_USD = { free: 0, pro: 19 } as const;

/** "$0", "$19", "$9.50". */
export function formatPrice(usd: number): string {
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** The pricing table rows (project.md §5), built from the plan limits. */
export function pricingRows(limits: { free: PlanLimits; pro: PlanLimits }): PricingRow[] {
  const row = (label: string, pick: (l: PlanLimits) => string): PricingRow => ({
    label,
    free: pick(limits.free),
    pro: pick(limits.pro),
  });
  const custom = (yes: string, no: string) => (l: PlanLimits) => (l.customize ? yes : no);

  return [
    row("Projects", (l) => formatCount(l.projects)),
    row("Messages / month (per project)", (l) => formatCount(l.messagesPerMonth)),
    row("Knowledge sources (per project)", (l) => formatCount(l.knowledgeSources)),
    row("Button color", custom("Any", "Default")),
    row("Button position", custom("Any corner", "Bottom right")),
    row("Button label", custom("Custom", "Default")),
    row("Open animation", custom("Fade / slide / scale", "Fade")),
    row("Header text", custom("Custom", "Default")),
    row('"Powered by" badge', (l) => (l.showBadge ? "Shown" : "Hidden")),
  ];
}
