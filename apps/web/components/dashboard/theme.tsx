"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  getServerSnapshot,
  getSystemPrefersDark,
  getThemeChoice,
  setThemeChoice,
  subscribeSystemTheme,
  subscribeThemeChoice,
} from "@/lib/theme/store";
import { DEFAULT_THEME_CHOICE, resolveTheme, THEME_SCRIPT, type ThemeChoice } from "@/lib/theme/theme";

type ThemeContextValue = { choice: ThemeChoice; setChoice: (choice: ThemeChoice) => void };

const ThemeContext = createContext<ThemeContextValue>({
  choice: DEFAULT_THEME_CHOICE,
  setChoice: setThemeChoice,
});

/** The owner's Light / Dark / System choice and a setter. */
export function useThemeChoice(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * The dashboard's themed root. The theme lives on this element, not on <html>,
 * so the landing page, /embed and the Clerk pages keep their own look.
 *
 * On a full page load the inline script sets `data-theme` before paint. React
 * leaves that attribute alone while hydrating (the server can't know the
 * theme), then takes over once the browser snapshots are read.
 */
export function DashboardThemeRoot({ className, children }: { className?: string; children: ReactNode }) {
  const choice = useSyncExternalStore(subscribeThemeChoice, getThemeChoice, getServerSnapshot);
  const systemDark = useSyncExternalStore(subscribeSystemTheme, getSystemPrefersDark, getServerSnapshot);
  const theme = choice === null || systemDark === null ? undefined : resolveTheme(choice, systemDark);

  return (
    <ThemeContext.Provider value={{ choice: choice ?? DEFAULT_THEME_CHOICE, setChoice: setThemeChoice }}>
      <div data-theme={theme} suppressHydrationWarning className={className}>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
