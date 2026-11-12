"use client";

import type { ReactNode } from "react";
import type { ThemeChoice } from "@/lib/theme/theme";
import { cn } from "@/components/ui/cn";
import { useThemeChoice } from "./theme";

const iconProps = {
  viewBox: "0 0 24 24",
  className: "size-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const OPTIONS: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg {...iconProps}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4.5" width="18" height="12" rx="2" />
        <path d="M8.5 20h7M12 16.5V20" />
      </svg>
    ),
  },
];

/**
 * Light / Dark / System switch for the dashboard header. Native radios, so Tab
 * reaches the group and the arrow keys move between options.
 */
export function ThemeToggle() {
  const { choice, setChoice } = useThemeChoice();

  return (
    <fieldset className="flex items-center rounded-pill border border-border bg-glass p-0.5 backdrop-blur-glass">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((option) => {
        const checked = choice === option.value;
        return (
          <label
            key={option.value}
            title={option.label}
            className={cn(
              "relative grid size-7 cursor-pointer place-items-center rounded-pill transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-fg",
              checked ? "bg-accent text-accent-fg" : "text-muted hover:bg-glass-strong hover:text-fg",
            )}
          >
            <input
              type="radio"
              name="dashboard-theme"
              value={option.value}
              checked={checked}
              onChange={() => setChoice(option.value)}
              className="sr-only"
            />
            {option.icon}
            <span className="sr-only">{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
