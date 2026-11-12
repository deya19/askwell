import { parseThemeChoice, THEME_STORAGE_KEY, type ThemeChoice } from "./theme";

/** The saved choice, or System when there is none or storage is blocked. */
export function readThemeChoice(): ThemeChoice {
  try {
    return parseThemeChoice(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return parseThemeChoice(null);
  }
}

/** Saves the choice. A blocked storage just means it won't survive a reload. */
export function writeThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked or full: keep the choice for this visit only.
  }
}
