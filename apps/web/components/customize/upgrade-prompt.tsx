import { ButtonLink } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { UPGRADE_MESSAGE, UPGRADE_PATH, UPGRADE_TITLE } from "./copy";

/** Shown to Free owners, and after a save gets 402 `plan_required`. */
export function UpgradePrompt({ role }: { role?: "alert" }) {
  return (
    <GlassPanel strong role={role} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-glass text-fg">
          <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight">{UPGRADE_TITLE}</h2>
          <p className="mt-1 text-sm text-pretty text-muted">{UPGRADE_MESSAGE}</p>
        </div>
      </div>
      <ButtonLink href={UPGRADE_PATH} className="shrink-0">
        Upgrade to Pro
      </ButtonLink>
    </GlassPanel>
  );
}
