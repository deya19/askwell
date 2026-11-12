/**
 * Dashboard theme (project.md §13): the owner picks Light, Dark or System.
 * System follows `prefers-color-scheme`. The choice lives in localStorage only.
 */

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type Theme = "light" | "dark";

export const DEFAULT_THEME_CHOICE: ThemeChoice = "system";
export const THEME_STORAGE_KEY = "dashboard-theme";
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

/** A stored value as a choice. Anything unknown (missing, old, tampered) means System. */
export function parseThemeChoice(value: unknown): ThemeChoice {
  return THEME_CHOICES.find((choice) => choice === value) ?? DEFAULT_THEME_CHOICE;
}

/** The theme to show for a stored value and the system preference. */
export function resolveTheme(stored: unknown, systemPrefersDark: boolean): Theme {
  const choice = parseThemeChoice(stored);
  if (choice === "system") return systemPrefersDark ? "dark" : "light";
  return choice;
}

/**
 * Runs inline as the first child of the themed element, before the dashboard
 * paints, so a hard refresh never flashes the wrong theme. Same rules as
 * `resolveTheme`; storage and matchMedia are each guarded so a blocked
 * localStorage still gets the system theme.
 */
export const THEME_SCRIPT = `(function(){var el=document.currentScript&&document.currentScript.parentElement;if(!el)return;var s=null;try{s=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}var d=false;try{d=window.matchMedia(${JSON.stringify(DARK_MEDIA_QUERY)}).matches}catch(e){}el.setAttribute("data-theme",s==="light"||s==="dark"?s:d?"dark":"light")})()`;
