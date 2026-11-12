import { afterEach, describe, expect, it, vi } from "vitest";
import { readThemeChoice, writeThemeChoice } from "./storage";
import { parseThemeChoice, resolveTheme, THEME_SCRIPT, THEME_STORAGE_KEY } from "./theme";

describe("parseThemeChoice", () => {
  it("keeps the three valid choices", () => {
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("dark")).toBe("dark");
    expect(parseThemeChoice("system")).toBe("system");
  });

  it("falls back to system for anything else", () => {
    for (const value of [null, undefined, "", "Dark", "blue", 1, {}]) {
      expect(parseThemeChoice(value)).toBe("system");
    }
  });
});

describe("resolveTheme", () => {
  it("follows the system when nothing is saved", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("uses an explicit choice whatever the system says", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("treats an unknown saved value as system", () => {
    expect(resolveTheme("purple", true)).toBe("dark");
    expect(resolveTheme("purple", false)).toBe("light");
  });
});

/** Runs the inline script against a fake element, storage and matchMedia. */
function runThemeScript({ stored, systemDark, storageThrows = false, matchMediaThrows = false }: {
  stored: string | null;
  systemDark: boolean;
  storageThrows?: boolean;
  matchMediaThrows?: boolean;
}): string | undefined {
  const attrs: Record<string, string> = {};
  const parentElement = { setAttribute: (name: string, value: string) => (attrs[name] = value) };
  const window = {
    get localStorage() {
      if (storageThrows) throw new Error("SecurityError");
      return { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) };
    },
    matchMedia: () => {
      if (matchMediaThrows) throw new Error("no matchMedia");
      return { matches: systemDark };
    },
  };
  const document = { currentScript: { parentElement } };
  new Function("window", "document", THEME_SCRIPT)(window, document);
  return attrs["data-theme"];
}

describe("THEME_SCRIPT", () => {
  it("matches resolveTheme for every stored value and system preference", () => {
    for (const stored of [null, "light", "dark", "system", "junk"]) {
      for (const systemDark of [true, false]) {
        expect(runThemeScript({ stored, systemDark })).toBe(resolveTheme(stored, systemDark));
      }
    }
  });

  it("falls back to the system theme when storage is blocked", () => {
    expect(runThemeScript({ stored: "light", systemDark: true, storageThrows: true })).toBe("dark");
    expect(runThemeScript({ stored: "dark", systemDark: false, storageThrows: true })).toBe("light");
  });

  it("falls back to light when matchMedia is missing", () => {
    expect(runThemeScript({ stored: null, systemDark: true, matchMediaThrows: true })).toBe("light");
  });
});

describe("theme storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage(store: Map<string, string>, throws = false) {
    const guard = () => {
      if (throws) throw new Error("SecurityError");
    };
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (guard(), store.get(k) ?? null),
        setItem: (k: string, v: string) => (guard(), store.set(k, v)),
        removeItem: (k: string) => (guard(), store.delete(k)),
      },
    });
  }

  it("round-trips a choice and clears it for system", () => {
    const store = new Map<string, string>();
    stubStorage(store);
    expect(readThemeChoice()).toBe("system");
    writeThemeChoice("dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(readThemeChoice()).toBe("dark");
    writeThemeChoice("system");
    expect(store.has(THEME_STORAGE_KEY)).toBe(false);
    expect(readThemeChoice()).toBe("system");
  });

  it("never throws when storage is blocked", () => {
    stubStorage(new Map(), true);
    expect(readThemeChoice()).toBe("system");
    expect(() => writeThemeChoice("dark")).not.toThrow();
  });
});
