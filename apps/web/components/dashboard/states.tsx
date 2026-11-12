import type { ReactNode } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/components/ui/cn";

/** Page title, a short description, and the page's main actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-pretty text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

/** A centered glass panel for empty and error states. */
export function StatePanel({
  icon,
  title,
  children,
  action,
  role,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <GlassPanel
      role={role}
      className="mt-8 flex flex-col items-center px-6 py-14 text-center sm:py-20"
    >
      <span aria-hidden className="grid size-12 place-items-center rounded-md border border-border bg-glass-strong text-fg">
        {icon}
      </span>
      <h2 className="mt-5 text-lg font-semibold tracking-tight">{title}</h2>
      {children && <div className="mt-2 max-w-sm text-sm text-pretty text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </GlassPanel>
  );
}

/** A grey placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-fg/10", className)} />;
}

const iconProps = {
  viewBox: "0 0 24 24",
  className: "size-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function ProjectsIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M3.5 9h17M8 4v5" />
    </svg>
  );
}

export function BillingIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 15h3" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5M12 16h.01" />
    </svg>
  );
}
