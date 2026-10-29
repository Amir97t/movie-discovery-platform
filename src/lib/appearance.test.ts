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
    for (const raw of [null, undefined, "", "not json", "null", "42", '"blue"', '"gold"', "[]"]) {
      expect(parseAppearance(raw)).toEqual(DEFAULT_APPEARANCE);
    }
  });

  it("keeps valid fields and defaults invalid ones independently", () => {
    expect(parseAppearance('{"palette":"crimson","mode":"banana"}')).toEqual({
      palette: "crimson",
      mode: "dark",
    });
    expect(parseAppearance('{"palette":"neon","mode":"light"}')).toEqual({
      palette: "blue",
      mode: "light",
    });
  });

  it("migrates legacy gold palette to blue seamlessly", () => {
    expect(parseAppearance('{"palette":"gold","mode":"light"}')).toEqual({
      palette: "blue",
      mode: "light",
    });
    expect(parseAppearance('{"palette":"gold","mode":"dark"}')).toEqual({
      palette: "blue",
      mode: "dark",
    });
  });

  it("round-trips through serialize", () => {
    const value = { palette: "crimson", mode: "dark" } as const;
    expect(parseAppearance(serializeAppearance(value))).toEqual(value);
    const blueVal = { palette: "blue", mode: "light" } as const;
    expect(parseAppearance(serializeAppearance(blueVal))).toEqual(blueVal);
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
});

describe("applyAppearance", () => {
  it("writes the data-attribute contract", () => {
    const root = document.createElement("html");
    const resolved = applyAppearance(root, { palette: "crimson", mode: "system" }, true);
    expect(resolved).toBe("dark");
    expect(root.dataset.palette).toBe("crimson");
    expect(root.dataset.mode).toBe("dark");
    expect(root.dataset.modePref).toBe("system");
    expect(root.style.colorScheme).toBe("dark");
  });
});

describe("pre-paint script parity", () => {
  function runScript(stored: string | null, prefersDark: boolean) {
    const root = document.createElement("html");
    const fakeDocument = { documentElement: root };
    const fakeStorage = { getItem: (key: string) => (key === APPEARANCE_STORAGE_KEY ? stored : null) };
    const fakeWindow = { matchMedia: () => ({ matches: prefersDark }) };
    new Function("document", "localStorage", "window", THEME_INIT_SCRIPT)(
      fakeDocument,
      fakeStorage,
      fakeWindow,
    );
    return { palette: root.dataset.palette, mode: root.dataset.mode, pref: root.dataset.modePref };
  }

  const cases = [
    null,
    "garbage",
    '{"palette":"crimson","mode":"light"}',
    '{"mode":"system"}',
    '{"palette":"x","mode":"dark"}',
    '{"palette":"gold","mode":"dark"}',
    '{"palette":"blue","mode":"dark"}',
  ];

  it("produces the same result as applyAppearance for stored and OS inputs", () => {
    for (const stored of cases) {
      for (const prefersDark of [true, false]) {
        const expected = parseAppearance(stored);
        const root = document.createElement("html");
        const resolved = applyAppearance(root, expected, prefersDark);
        expect(runScript(stored, prefersDark)).toEqual({
          palette: expected.palette,
          mode: resolved,
          pref: expected.mode,
        });
      }
    }
  });
});
