import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  applyAppearance,
  parseAppearance,
  readStoredAppearance,
  resolveMode,
  serializeAppearance,
  writeStoredAppearance,
} from "./appearance";
import { THEME_INIT_SCRIPT } from "./theme-script";

describe("parseAppearance", () => {
  it("falls back to defaults for empty, corrupt or wrong-typed storage", () => {
    for (const raw of [null, undefined, "", "not json", "null", "42", "[]"]) {
      expect(parseAppearance(raw)).toEqual(DEFAULT_APPEARANCE);
    }
  });

  it("extracts and preserves valid modes and defaults invalid ones", () => {
    expect(parseAppearance('{"mode":"light"}')).toEqual({ mode: "light" });
    expect(parseAppearance('{"mode":"dark"}')).toEqual({ mode: "dark" });
    expect(parseAppearance('{"mode":"system"}')).toEqual({ mode: "system" });
    expect(parseAppearance('{"mode":"banana"}')).toEqual({ mode: "dark" });
  });

  it("migrates legacy records with palette keys while preserving their saved mode", () => {
    expect(parseAppearance('{"palette":"blue","mode":"light"}')).toEqual({ mode: "light" });
    expect(parseAppearance('{"palette":"crimson","mode":"dark"}')).toEqual({ mode: "dark" });
    expect(parseAppearance('{"palette":"gold","mode":"system"}')).toEqual({ mode: "system" });
    expect(parseAppearance('{"palette":"gold"}')).toEqual({ mode: "dark" });
  });

  it("round-trips through serialize", () => {
    const darkVal = { mode: "dark" } as const;
    expect(parseAppearance(serializeAppearance(darkVal))).toEqual(darkVal);
    const lightVal = { mode: "light" } as const;
    expect(parseAppearance(serializeAppearance(lightVal))).toEqual(lightVal);
  });
});

describe("resolveMode", () => {
  it("resolves system from the OS preference and leaves explicit modes alone", () => {
    expect(resolveMode("system", true)).toBe("dark");
    expect(resolveMode("system", false)).toBe("light");
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
  });
});

describe("storage helpers", () => {
  it("never throws when storage throws", () => {
    const broken = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    };
    expect(readStoredAppearance(broken)).toEqual(DEFAULT_APPEARANCE);
    expect(writeStoredAppearance(broken, DEFAULT_APPEARANCE)).toBe(false);
    expect(writeStoredAppearance(null, DEFAULT_APPEARANCE)).toBe(false);
  });

  it("migrates legacy palette records in storage to canonical mode-only JSON", () => {
    let saved: string | null = null;
    const storage = {
      getItem: () => '{"palette":"blue","mode":"light"}',
      setItem: (_k: string, v: string) => {
        saved = v;
      },
    };
    const appearance = readStoredAppearance(storage);
    expect(appearance).toEqual({ mode: "light" });
    expect(saved).toBe(JSON.stringify({ mode: "light" }));
  });
});

describe("applyAppearance", () => {
  it("writes the data-mode contract and removes any legacy data-palette", () => {
    const root = document.createElement("html");
    root.dataset.palette = "blue";
    const resolved = applyAppearance(root, { mode: "system" }, true);
    expect(resolved).toBe("dark");
    expect(root.dataset.mode).toBe("dark");
    expect(root.dataset.modePref).toBe("system");
    expect(root.style.colorScheme).toBe("dark");
    expect(root.dataset.palette).toBeUndefined();
  });
});

describe("pre-paint script parity", () => {
  function runScript(stored: string | null, prefersDark: boolean) {
    const root = document.createElement("html");
    root.dataset.palette = "blue";
    const fakeDocument = { documentElement: root };
    const fakeStorage = { getItem: (key: string) => (key === APPEARANCE_STORAGE_KEY ? stored : null) };
    const fakeWindow = { matchMedia: () => ({ matches: prefersDark }) };
    new Function("document", "localStorage", "window", THEME_INIT_SCRIPT)(
      fakeDocument,
      fakeStorage,
      fakeWindow,
    );
    return { mode: root.dataset.mode, pref: root.dataset.modePref, palette: root.dataset.palette };
  }

  const cases = [
    null,
    "garbage",
    '{"mode":"light"}',
    '{"mode":"dark"}',
    '{"mode":"system"}',
    '{"palette":"crimson","mode":"light"}',
    '{"palette":"blue","mode":"dark"}',
    '{"palette":"gold","mode":"system"}',
  ];

  it("produces the same result as applyAppearance for stored and OS inputs", () => {
    for (const stored of cases) {
      for (const prefersDark of [true, false]) {
        const expected = parseAppearance(stored);
        const root = document.createElement("html");
        const resolved = applyAppearance(root, expected, prefersDark);
        expect(runScript(stored, prefersDark)).toEqual({
          mode: resolved,
          pref: expected.mode,
          palette: undefined,
        });
      }
    }
  });

  it("migrates legacy records in storage to mode-only during pre-paint script execution", () => {
    let saved: string | null = null;
    const root = document.createElement("html");
    const fakeDocument = { documentElement: root };
    const fakeStorage = {
      getItem: () => '{"palette":"gold","mode":"light"}',
      setItem: (_k: string, v: string) => {
        saved = v;
      },
    };
    const fakeWindow = { matchMedia: () => ({ matches: true }) };
    new Function("document", "localStorage", "window", THEME_INIT_SCRIPT)(
      fakeDocument,
      fakeStorage,
      fakeWindow,
    );
    expect(root.dataset.mode).toBe("light");
    expect(root.dataset.modePref).toBe("light");
    expect(saved).toBe(JSON.stringify({ mode: "light" }));
  });
});
