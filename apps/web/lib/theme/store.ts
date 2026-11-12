import { readThemeChoice, writeThemeChoice } from "./storage";
import { DARK_MEDIA_QUERY, THEME_STORAGE_KEY, type ThemeChoice } from "./theme";

/**
 * Browser-side theme state for `useSyncExternalStore`: the owner's choice and
 * the system preference. Server snapshots are `null` (unknown until the browser runs).
 */

// Kept in memory too, so the choice holds for this visit even when storage is blocked.
let currentChoice: ThemeChoice | null = null;
const choiceListeners = new Set<() => void>();

export function getThemeChoice(): ThemeChoice {
  currentChoice ??= readThemeChoice();
  return currentChoice;
}

export function setThemeChoice(choice: ThemeChoice): void {
  currentChoice = choice;
  writeThemeChoice(choice);
  choiceListeners.forEach((listener) => listener());
}

/** Also picks up a choice made in another tab. */
export function subscribeThemeChoice(listener: () => void): () => void {
  choiceListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    currentChoice = readThemeChoice();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    choiceListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function darkQuery(): MediaQueryList | null {
  try {
    return window.matchMedia(DARK_MEDIA_QUERY);
  } catch {
    return null;
  }
}

export function getSystemPrefersDark(): boolean {
  return darkQuery()?.matches ?? false;
}

/** Fires when the OS switches between light and dark. */
export function subscribeSystemTheme(listener: () => void): () => void {
  const query = darkQuery();
  query?.addEventListener("change", listener);
  return () => query?.removeEventListener("change", listener);
}

export const getServerSnapshot = (): null => null;
