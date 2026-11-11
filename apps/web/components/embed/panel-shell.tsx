import type { ReactNode } from "react";

/** The full-iframe frame: soft monochrome glows behind a light glass panel (project.md §13). */
export function PanelShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg text-fg">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.08),transparent)]" />
        <div className="absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.06),transparent)]" />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** The panel header: title plus a close button. */
export function PanelHeader({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-glass-strong px-4 backdrop-blur-glass">
      <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="grid size-8 shrink-0 place-items-center rounded-pill text-muted transition hover:bg-glass hover:text-fg"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </header>
  );
}
